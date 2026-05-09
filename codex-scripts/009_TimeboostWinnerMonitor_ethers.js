const { ethers } = require("ethers");

const WS_URL = "wss://arb1.arbitrum.io/ws";
const RPC_URL = "https://arb1.arbitrum.io/rpc";
const EXPRESS_LANE_AUCTION_ADDRESS = "0x5fcb496a31b7AE91e7c9078Ec662bd7A55cd3079";
const POLL_INTERVAL_MS = 5000;
const MAX_EVENTS = Number(process.env.MAX_EVENTS ?? 5);
const MAX_DURATION_MS = Number(process.env.MAX_DURATION_MS ?? 12000);

const EXPRESS_LANE_AUCTION_ABI = [
    "function currentRound() external view returns (uint64)",
    "function expressLaneControllerByRound(uint64 round) external view returns (address)",
    "function roundTimestamps(uint64 round) external view returns (uint64 start, uint64 end)",
    "function reservePrice() external view returns (uint256)",
    "function biddingToken() external view returns (address)",
    "event AuctionResolved(uint64 indexed round, address indexed firstPriceBidder, address indexed expressLaneController, uint256 price)",
];

const ERC20_ABI = [
    "function symbol() external view returns (string)",
    "function decimals() external view returns (uint8)",
];

let tokenSymbol = "ETH";
let tokenDecimals = 18;
const fmtToken = (val) => ethers.formatUnits(val, tokenDecimals);

const stats = {
    totalAuctions: 0,
    totalRevenue: 0n,
    winnerCounts: {},
    controllerCounts: {},
    highestBid: { round: 0, price: 0n, bidder: "" },
    lowestBid: { round: 0, price: ethers.MaxUint256, bidder: "" },
};

function updateStats(round, bidder, controller, price) {
    stats.totalAuctions++;
    stats.totalRevenue += price;

    stats.winnerCounts[bidder] = (stats.winnerCounts[bidder] || 0) + 1;
    stats.controllerCounts[controller] = (stats.controllerCounts[controller] || 0) + 1;

    if (price > stats.highestBid.price) {
        stats.highestBid = { round: Number(round), price, bidder };
    }
    if (price < stats.lowestBid.price) {
        stats.lowestBid = { round: Number(round), price, bidder };
    }
}

function printStats() {
    console.log("\nRUNNING STATS");
    console.log("Total auctions observed:", stats.totalAuctions);
    console.log("Total revenue:", fmtToken(stats.totalRevenue), tokenSymbol);
    console.log("Avg price:", stats.totalAuctions > 0
        ? fmtToken(stats.totalRevenue / BigInt(stats.totalAuctions))
        : "0", tokenSymbol);
    console.log("Highest bid:", fmtToken(stats.highestBid.price), tokenSymbol,
        `(round ${stats.highestBid.round}, ${stats.highestBid.bidder})`);
    if (stats.lowestBid.price !== ethers.MaxUint256) {
        console.log("Lowest bid:", fmtToken(stats.lowestBid.price), tokenSymbol,
            `(round ${stats.lowestBid.round}, ${stats.lowestBid.bidder})`);
    }

    console.log("\nTop bidders:");
    Object.entries(stats.winnerCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .forEach(([addr, count]) => console.log(`  ${addr}: ${count} wins`));

    console.log("\nTop controllers:");
    Object.entries(stats.controllerCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .forEach(([addr, count]) => console.log(`  ${addr}: ${count} rounds`));
}

async function monitorWebSocket() {
    console.log("TIMEBOOST WINNER MONITOR (WebSocket)");
    console.log("Listening for AuctionResolved events...\n");

    const provider = new ethers.WebSocketProvider(WS_URL);

    // Wait for WS to connect or fail before setting up listeners
    await Promise.race([
        new Promise((resolve, reject) => {
            provider.websocket.on("open", resolve);
            provider.websocket.on("error", reject);
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("WebSocket timeout")), 10000)),
    ]);

    const auction = new ethers.Contract(EXPRESS_LANE_AUCTION_ADDRESS, EXPRESS_LANE_AUCTION_ABI, provider);

    const [currentRound, reservePrice, biddingTokenAddress] = await Promise.all([
        auction.currentRound(), auction.reservePrice(), auction.biddingToken(),
    ]);

    const biddingToken = new ethers.Contract(biddingTokenAddress, ERC20_ABI, provider);
    const [symbol, decimals] = await Promise.all([biddingToken.symbol(), biddingToken.decimals()]);
    tokenSymbol = symbol;
    tokenDecimals = Number(decimals);

    console.log("Current round:", currentRound.toString());
    console.log("Reserve price:", fmtToken(reservePrice), tokenSymbol);
    console.log("\nWaiting for new auction results...\n");

    auction.on("AuctionResolved", (round, firstPriceBidder, expressLaneController, price, event) => {
        const timestamp = new Date().toISOString();
        console.log(`AUCTION RESOLVED [${timestamp}]`);
        console.log("Round:", round.toString());
        console.log("Winning bidder:", firstPriceBidder);
        console.log("Express lane controller:", expressLaneController);
        console.log("Price:", fmtToken(price), tokenSymbol);
        console.log("Block:", event.log.blockNumber);
        console.log("Tx:", event.log.transactionHash);

        updateStats(round, firstPriceBidder, expressLaneController, price);
        printStats();
    });

    // Keep alive
    process.once("SIGINT", () => {
        console.log("\n\nShutting down monitor...");
        printStats();
        provider.destroy();
        process.exit(0);
    });
}

async function monitorPolling() {
    console.log("TIMEBOOST WINNER MONITOR (Polling)");
    console.log(`Polling every ${POLL_INTERVAL_MS / 1000}s for AuctionResolved events...\n`);

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const auction = new ethers.Contract(EXPRESS_LANE_AUCTION_ADDRESS, EXPRESS_LANE_AUCTION_ABI, provider);

    const [currentRound, reservePrice, biddingTokenAddress] = await Promise.all([
        auction.currentRound(), auction.reservePrice(), auction.biddingToken(),
    ]);

    const biddingToken = new ethers.Contract(biddingTokenAddress, ERC20_ABI, provider);
    const [symbol, decimals] = await Promise.all([biddingToken.symbol(), biddingToken.decimals()]);
    tokenSymbol = symbol;
    tokenDecimals = Number(decimals);

    console.log("Current round:", currentRound.toString());
    console.log("Reserve price:", fmtToken(reservePrice), tokenSymbol);

    let lastBlock = await provider.getBlockNumber();
    console.log("Starting from block:", lastBlock);
    console.log("\nWaiting for new auction results...\n");

    const poll = async () => {
        try {
            const currentBlock = await provider.getBlockNumber();
            if (currentBlock <= lastBlock) return;

            const filter = auction.filters.AuctionResolved();
            const events = await auction.queryFilter(filter, lastBlock + 1, currentBlock);

            for (const event of events) {
                const timestamp = new Date().toISOString();
                console.log(`AUCTION RESOLVED [${timestamp}]`);
                console.log("Round:", event.args.round.toString());
                console.log("Winning bidder:", event.args.firstPriceBidder);
                console.log("Express lane controller:", event.args.expressLaneController);
                console.log("Price:", fmtToken(event.args.price), tokenSymbol);
                console.log("Block:", event.blockNumber);
                console.log("Tx:", event.transactionHash);

                updateStats(event.args.round, event.args.firstPriceBidder, event.args.expressLaneController, event.args.price);
                printStats();
            }

            lastBlock = currentBlock;
        } catch (err) {
            console.error("Polling error:", err.message);
        }
    };

    const interval = setInterval(() => {
        poll();
        if (stats.totalAuctions >= MAX_EVENTS) {
            console.log(`\n\nReached MAX_EVENTS=${MAX_EVENTS}.`);
            clearInterval(interval);
            printStats();
            process.exit(0);
        }
    }, POLL_INTERVAL_MS);

    setTimeout(() => {
        console.log(`\n\nReached MAX_DURATION_MS=${MAX_DURATION_MS}.`);
        clearInterval(interval);
        printStats();
        process.exit(0);
    }, MAX_DURATION_MS);

    process.once("SIGINT", () => {
        console.log("\n\nShutting down monitor...");
        clearInterval(interval);
        printStats();
        process.exit(0);
    });
}

(async () => {
    try {
        await monitorWebSocket();
    } catch (err) {
        console.log("WebSocket unavailable, falling back to polling...");
        console.log("Reason:", err.message, "\n");
        await monitorPolling();
    }
})();
