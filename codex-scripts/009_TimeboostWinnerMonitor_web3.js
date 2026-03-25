const { Web3 } = require("web3");

// ==================== CONFIGURATION ====================
const WS_URL = "wss://arb1.arbitrum.io/ws";
const RPC_URL = "https://arb1.arbitrum.io/rpc";
const EXPRESS_LANE_AUCTION_ADDRESS = "0x00a0F15B79D1D3E5991929FaAbCf2Aa65623530d";
const POLL_INTERVAL_MS = 5000;

// ==================== ABI ====================
const EXPRESS_LANE_AUCTION_ABI = [
    {
        name: "currentRound",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint64" }],
    },
    {
        name: "expressLaneControllerByRound",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "round", type: "uint64" }],
        outputs: [{ name: "", type: "address" }],
    },
    {
        name: "roundTimestamps",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "round", type: "uint64" }],
        outputs: [
            { name: "start", type: "uint64" },
            { name: "end", type: "uint64" },
        ],
    },
    {
        name: "reservePrice",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
    },
    {
        name: "biddingToken",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "address" }],
    },
    {
        name: "AuctionResolved",
        type: "event",
        inputs: [
            { name: "round", type: "uint64", indexed: true },
            { name: "firstPriceBidder", type: "address", indexed: true },
            { name: "expressLaneController", type: "address", indexed: true },
            { name: "price", type: "uint256", indexed: false },
        ],
    },
];

const ERC20_ABI = [
    {
        name: "symbol",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "string" }],
    },
    {
        name: "decimals",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint8" }],
    },
];

// ==================== TOKEN INFO ====================
let tokenSymbol = "ETH";
let tokenDecimals = 18;
const fmtToken = (val) => {
    const str = val.toString().padStart(tokenDecimals + 1, "0");
    const whole = str.slice(0, str.length - tokenDecimals) || "0";
    const frac = str.slice(str.length - tokenDecimals).replace(/0+$/, "");
    return frac ? `${whole}.${frac}` : whole;
};

// ==================== STATS ====================
const stats = {
    totalAuctions: 0,
    totalRevenue: 0n,
    winnerCounts: {},
    controllerCounts: {},
    highestBid: { round: 0, price: 0n, bidder: "" },
    lowestBid: { round: 0, price: BigInt("0x" + "f".repeat(64)), bidder: "" },
};

function updateStats(round, bidder, controller, price) {
    const priceBig = BigInt(price);
    stats.totalAuctions++;
    stats.totalRevenue += priceBig;

    stats.winnerCounts[bidder] = (stats.winnerCounts[bidder] || 0) + 1;
    stats.controllerCounts[controller] = (stats.controllerCounts[controller] || 0) + 1;

    if (priceBig > stats.highestBid.price) {
        stats.highestBid = { round: Number(round), price: priceBig, bidder };
    }
    if (priceBig < stats.lowestBid.price) {
        stats.lowestBid = { round: Number(round), price: priceBig, bidder };
    }
}

function printStats() {
    console.log("\n==================== RUNNING STATS ====================");
    console.log("Total auctions observed:", stats.totalAuctions);
    console.log("Total revenue:", fmtToken(stats.totalRevenue), tokenSymbol);
    console.log("Avg price:", stats.totalAuctions > 0
        ? fmtToken(stats.totalRevenue / BigInt(stats.totalAuctions))
        : "0", tokenSymbol);
    console.log("Highest bid:", fmtToken(stats.highestBid.price), tokenSymbol,
        `(round ${stats.highestBid.round}, ${stats.highestBid.bidder})`);
    if (stats.lowestBid.price !== BigInt("0x" + "f".repeat(64))) {
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

// ==================== WEBSOCKET MONITOR ====================
async function monitorWebSocket() {
    console.log("==================== TIMEBOOST WINNER MONITOR (WebSocket) ====================");
    console.log("Listening for AuctionResolved events...\n");

    const web3 = new Web3(WS_URL);

    // Verify WS is connected before proceeding (timeout after 10s)
    await Promise.race([
        web3.eth.getBlockNumber(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("WebSocket timeout")), 10000)),
    ]);

    const auction = new web3.eth.Contract(EXPRESS_LANE_AUCTION_ABI, EXPRESS_LANE_AUCTION_ADDRESS);

    const currentRound = await auction.methods.currentRound().call();
    const reservePrice = await auction.methods.reservePrice().call();
    const biddingTokenAddress = await auction.methods.biddingToken().call();

    const biddingToken = new web3.eth.Contract(ERC20_ABI, biddingTokenAddress);
    tokenSymbol = await biddingToken.methods.symbol().call();
    tokenDecimals = Number(await biddingToken.methods.decimals().call());

    console.log("Current round:", currentRound.toString());
    console.log("Reserve price:", fmtToken(reservePrice), tokenSymbol);
    console.log("\nWaiting for new auction results...\n");

    const subscription = auction.events.AuctionResolved();

    subscription.on("data", (event) => {
        const { round, firstPriceBidder, expressLaneController, price } = event.returnValues;
        const timestamp = new Date().toISOString();

        console.log(`==================== AUCTION RESOLVED [${timestamp}] ====================`);
        console.log("Round:", round.toString());
        console.log("Winning bidder:", firstPriceBidder);
        console.log("Express lane controller:", expressLaneController);
        console.log("Price:", fmtToken(price), tokenSymbol);
        console.log("Block:", event.blockNumber.toString());
        console.log("Tx:", event.transactionHash);

        updateStats(round, firstPriceBidder, expressLaneController, price);
        printStats();
    });

    subscription.on("error", (err) => {
        console.error("Subscription error:", err.message);
    });

    process.once("SIGINT", () => {
        console.log("\n\nShutting down monitor...");
        printStats();
        web3.currentProvider.disconnect();
        process.exit(0);
    });
}

// ==================== POLLING MONITOR (FALLBACK) ====================
async function monitorPolling() {
    console.log("==================== TIMEBOOST WINNER MONITOR (Polling) ====================");
    console.log(`Polling every ${POLL_INTERVAL_MS / 1000}s for AuctionResolved events...\n`);

    const web3 = new Web3(RPC_URL);
    const auction = new web3.eth.Contract(EXPRESS_LANE_AUCTION_ABI, EXPRESS_LANE_AUCTION_ADDRESS);

    const currentRound = await auction.methods.currentRound().call();
    const reservePrice = await auction.methods.reservePrice().call();
    const biddingTokenAddress = await auction.methods.biddingToken().call();

    const biddingToken = new web3.eth.Contract(ERC20_ABI, biddingTokenAddress);
    tokenSymbol = await biddingToken.methods.symbol().call();
    tokenDecimals = Number(await biddingToken.methods.decimals().call());

    console.log("Current round:", currentRound.toString());
    console.log("Reserve price:", fmtToken(reservePrice), tokenSymbol);

    let lastBlock = Number(await web3.eth.getBlockNumber());
    console.log("Starting from block:", lastBlock);
    console.log("\nWaiting for new auction results...\n");

    const poll = async () => {
        try {
            const currentBlock = Number(await web3.eth.getBlockNumber());
            if (currentBlock <= lastBlock) return;

            const events = await auction.getPastEvents("AuctionResolved", {
                fromBlock: lastBlock + 1,
                toBlock: currentBlock,
            });

            for (const event of events) {
                const { round, firstPriceBidder, expressLaneController, price } = event.returnValues;
                const timestamp = new Date().toISOString();

                console.log(`==================== AUCTION RESOLVED [${timestamp}] ====================`);
                console.log("Round:", round.toString());
                console.log("Winning bidder:", firstPriceBidder);
                console.log("Express lane controller:", expressLaneController);
                console.log("Price:", fmtToken(price), tokenSymbol);
                console.log("Block:", event.blockNumber.toString());
                console.log("Tx:", event.transactionHash);

                updateStats(round, firstPriceBidder, expressLaneController, price);
                printStats();
            }

            lastBlock = currentBlock;
        } catch (err) {
            console.error("Polling error:", err.message);
        }
    };

    const interval = setInterval(poll, POLL_INTERVAL_MS);

    process.once("SIGINT", () => {
        console.log("\n\nShutting down monitor...");
        clearInterval(interval);
        printStats();
        process.exit(0);
    });
}

// ==================== ENTRY POINT ====================
(async () => {
    try {
        await monitorWebSocket();
    } catch (err) {
        console.log("WebSocket unavailable, falling back to polling...");
        console.log("Reason:", err.message, "\n");
        await monitorPolling();
    }
})();
