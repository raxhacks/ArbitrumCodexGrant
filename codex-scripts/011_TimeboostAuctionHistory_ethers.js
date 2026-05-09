const { ethers } = require("ethers");

const RPC_URL = "https://arb1.arbitrum.io/rpc";
const CHAIN_ID = 42161;
const EXPRESS_LANE_AUCTION_ADDRESS = "0x5fcb496a31b7AE91e7c9078Ec662bd7A55cd3079";
let FROM_BLOCK = 0;         // Starting block (0 = auto-calculate recent range)
const TO_BLOCK = "latest";  // End block
const FILTER_BIDDER = "";   // Filter by bidder address (empty = all)
const FILTER_CONTROLLER = ""; // Filter by controller address (empty = all)

const ERC20_ABI = [
    "function symbol() external view returns (string)",
    "function decimals() external view returns (uint8)",
];

const FALLBACK_ABI = [
    "function currentRound() external view returns (uint64)",
    "function reservePrice() external view returns (uint256)",
    "function roundTimingInfo() external view returns (int64 offsetTimestamp, uint64 roundDurationSeconds, uint64 auctionClosingSeconds, uint64 reserveSubmissionSeconds)",
    "function biddingToken() external view returns (address)",
    "event AuctionResolved(bool indexed isMultiBidAuction, uint64 round, address indexed firstPriceBidder, address indexed firstPriceExpressLaneController, uint256 firstPriceAmount, uint256 price, uint64 roundStartTimestamp, uint64 roundEndTimestamp)",
];

async function loadAbi(chainId, address, provider, fallback) {
    try {
        const slot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
        const raw = await provider.getStorage(address, slot);
        const impl = raw && raw !== "0x" ? "0x" + raw.slice(-40) : null;
        const target = impl && impl !== "0x0000000000000000000000000000000000000000" ? impl : address;
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 5000);
        const res = await fetch(`https://sourcify.dev/server/files/any/${chainId}/${target}`, { signal: ctrl.signal });
        clearTimeout(timer);
        if (!res.ok) throw new Error(`Sourcify ${res.status}`);
        const body = await res.json();
        const meta = body.files?.find((f) => f.name === "metadata.json");
        if (!meta) throw new Error("metadata.json missing");
        return JSON.parse(meta.content).output.abi;
    } catch (err) {
        return fallback;
    }
}

async function readAuctionHistory() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const abi = await loadAbi(CHAIN_ID, EXPRESS_LANE_AUCTION_ADDRESS, provider, FALLBACK_ABI);
    const auction = new ethers.Contract(EXPRESS_LANE_AUCTION_ADDRESS, abi, provider);

    const [currentRound, reservePrice, timing, biddingTokenAddress] = await Promise.all([
        auction.currentRound(), auction.reservePrice(),
        auction.roundTimingInfo(), auction.biddingToken(),
    ]);
    const roundDuration = timing.roundDurationSeconds;

    const biddingToken = new ethers.Contract(biddingTokenAddress, ERC20_ABI, provider);
    const [symbol, decimals] = await Promise.all([biddingToken.symbol(), biddingToken.decimals()]);
    const fmt = (val) => ethers.formatUnits(val, decimals);

    console.log("AUCTION INFO");
    console.log("Current round:", currentRound.toString());
    console.log("Bidding token:", biddingTokenAddress, `(${symbol})`);
    console.log("Reserve price:", fmt(reservePrice), symbol);
    console.log("Round duration:", roundDuration.toString(), "seconds");

    const filter = auction.filters.AuctionResolved();

    if (FROM_BLOCK === 0) {
        const currentBlock = await provider.getBlockNumber();
        FROM_BLOCK = Math.max(0, Number(currentBlock) - 1000);
    }
    const TO_BLOCK_NUM = Number(await provider.getBlockNumber());

    console.log("\nFETCHING AUCTION HISTORY");
    console.log("From block:", FROM_BLOCK);
    console.log("To block:", TO_BLOCK);
    if (FILTER_BIDDER) console.log("Filtering by bidder:", FILTER_BIDDER);
    if (FILTER_CONTROLLER) console.log("Filtering by controller:", FILTER_CONTROLLER);

    const allEvents = await auction.queryFilter(filter, FROM_BLOCK, TO_BLOCK_NUM);
    console.log("Total auction results found:", allEvents.length);

    if (allEvents.length === 0) {
        console.log("\nNo auction results found.");
        return;
    }

    const recent = allEvents.slice(-200);
    const iface = auction.interface;
    const results = recent.map((event) => {
        const parsed = iface.parseLog({ topics: event.topics, data: event.data });
        const a = parsed.args;
        return {
            round: a.round,
            bidder: a.firstPriceBidder,
            controller: a.firstPriceExpressLaneController,
            price: a.price,
            firstPriceAmount: a.firstPriceAmount,
            block: event.blockNumber,
            tx: event.transactionHash,
            timestamp: a.roundStartTimestamp,
        };
    });

    // Display the most recent results (cap at 50 to keep output readable)
    console.log("\nAUCTION RESULTS (most recent 50)");
    results.slice(-50).forEach((r, index) => {
        const date = new Date(Number(r.timestamp) * 1000).toISOString();
        console.log(`\n--- Round ${r.round.toString()} ---`);
        console.log("Date:", date);
        console.log("Winning bidder:", r.bidder);
        console.log("Express lane controller:", r.controller);
        console.log("Price:", fmt(r.price), symbol);
        console.log("Block:", r.block);
    });

    // Summary
    const prices = results.map((r) => r.price);
    const totalRevenue = prices.reduce((a, b) => a + b, 0n);
    const sorted = [...prices].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const avgPrice = totalRevenue / BigInt(results.length);

    // Unique bidders and controllers
    const uniqueBidders = [...new Set(results.map((r) => r.bidder))];
    const uniqueControllers = [...new Set(results.map((r) => r.controller))];

    // Bidder leaderboard
    const bidderWins = {};
    const bidderSpend = {};
    results.forEach((r) => {
        bidderWins[r.bidder] = (bidderWins[r.bidder] || 0) + 1;
        bidderSpend[r.bidder] = (bidderSpend[r.bidder] || 0n) + r.price;
    });

    // Controller leaderboard
    const controllerRounds = {};
    results.forEach((r) => {
        controllerRounds[r.controller] = (controllerRounds[r.controller] || 0) + 1;
    });

    console.log("\nSUMMARY");
    console.log("Total auctions:", results.length);
    console.log("Total revenue:", fmt(totalRevenue), symbol);
    console.log("Average price:", fmt(avgPrice), symbol);
    console.log("Lowest price:", fmt(sorted[0]), symbol);
    console.log("Highest price:", fmt(sorted[sorted.length - 1]), symbol);
    console.log("Unique bidders:", uniqueBidders.length);
    console.log("Unique controllers:", uniqueControllers.length);

    console.log("\nBIDDER LEADERBOARD");
    Object.entries(bidderWins)
        .sort((a, b) => b[1] - a[1])
        .forEach(([addr, wins]) => {
            const spent = bidderSpend[addr];
            console.log(`  ${addr}`);
            console.log(`    Wins: ${wins} | Total spent: ${fmt(spent)} ${symbol} | Avg: ${fmt(spent / BigInt(wins))} ${symbol}`);
        });

    console.log("\nCONTROLLER LEADERBOARD");
    Object.entries(controllerRounds)
        .sort((a, b) => b[1] - a[1])
        .forEach(([addr, rounds]) => {
            console.log(`  ${addr}: ${rounds} rounds`);
        });

    // Time series (grouped by day)
    const dailyData = {};
    results.forEach((r) => {
        const day = new Date(Number(r.timestamp) * 1000).toISOString().split("T")[0];
        if (!dailyData[day]) {
            dailyData[day] = { count: 0, total: 0n, min: r.price, max: r.price };
        }
        dailyData[day].count++;
        dailyData[day].total += r.price;
        if (r.price < dailyData[day].min) dailyData[day].min = r.price;
        if (r.price > dailyData[day].max) dailyData[day].max = r.price;
    });

    console.log("\nDAILY BREAKDOWN");
    Object.entries(dailyData)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .forEach(([day, data]) => {
            const avg = data.total / BigInt(data.count);
            console.log(`  ${day} | Auctions: ${data.count} | Avg: ${fmt(avg)} ${symbol} | Min: ${fmt(data.min)} ${symbol} | Max: ${fmt(data.max)} ${symbol}`);
        });
}

readAuctionHistory().catch((err) => {
    console.error("Error reading auction history:", err.message);
    process.exit(1);
});
