const { ethers } = require("ethers");

// ==================== CONFIGURATION ====================
const RPC_URL = "https://arb1.arbitrum.io/rpc";
const EXPRESS_LANE_AUCTION_ADDRESS = "0x00a0F15B79D1D3E5991929FaAbCf2Aa65623530d";
let FROM_BLOCK = 0;         // Starting block (0 = auto-calculate recent range)
const TO_BLOCK = "latest";  // End block
const FILTER_BIDDER = "";   // Filter by bidder address (empty = all)
const FILTER_CONTROLLER = ""; // Filter by controller address (empty = all)

// ==================== ABI ====================
const EXPRESS_LANE_AUCTION_ABI = [
    "function currentRound() external view returns (uint64)",
    "function reservePrice() external view returns (uint256)",
    "function roundDurationSeconds() external view returns (uint64)",
    "function biddingToken() external view returns (address)",
    "event AuctionResolved(uint64 indexed round, address indexed firstPriceBidder, address indexed expressLaneController, uint256 price)",
];

const ERC20_ABI = [
    "function symbol() external view returns (string)",
    "function decimals() external view returns (uint8)",
];

// ==================== MAIN ====================
async function readAuctionHistory() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const auction = new ethers.Contract(EXPRESS_LANE_AUCTION_ADDRESS, EXPRESS_LANE_AUCTION_ABI, provider);

    const [currentRound, reservePrice, roundDuration, biddingTokenAddress] = await Promise.all([
        auction.currentRound(), auction.reservePrice(),
        auction.roundDurationSeconds(), auction.biddingToken(),
    ]);

    const biddingToken = new ethers.Contract(biddingTokenAddress, ERC20_ABI, provider);
    const [symbol, decimals] = await Promise.all([biddingToken.symbol(), biddingToken.decimals()]);
    const fmt = (val) => ethers.formatUnits(val, decimals);

    console.log("==================== AUCTION INFO ====================");
    console.log("Current round:", currentRound.toString());
    console.log("Bidding token:", biddingTokenAddress, `(${symbol})`);
    console.log("Reserve price:", fmt(reservePrice), symbol);
    console.log("Round duration:", roundDuration.toString(), "seconds");

    // Build filter
    const filter = auction.filters.AuctionResolved(
        null,
        FILTER_BIDDER || null,
        FILTER_CONTROLLER || null
    );

    // Auto-calculate start block if FROM_BLOCK is 0 (public RPCs limit log query range)
    if (FROM_BLOCK === 0) {
        const currentBlock = await provider.getBlockNumber();
        FROM_BLOCK = Math.max(0, currentBlock - 1_000_000);
    }

    console.log("\n==================== FETCHING AUCTION HISTORY ====================");
    console.log("From block:", FROM_BLOCK);
    console.log("To block:", TO_BLOCK);
    if (FILTER_BIDDER) console.log("Filtering by bidder:", FILTER_BIDDER);
    if (FILTER_CONTROLLER) console.log("Filtering by controller:", FILTER_CONTROLLER);

    const events = await auction.queryFilter(filter, FROM_BLOCK, TO_BLOCK);
    console.log("Total auction results found:", events.length);

    if (events.length === 0) {
        console.log("\nNo auction results found.");
        return;
    }

    // Fetch block timestamps for each event
    const blockCache = {};
    const getBlockTimestamp = async (blockNumber) => {
        if (!blockCache[blockNumber]) {
            const block = await provider.getBlock(blockNumber);
            blockCache[blockNumber] = block.timestamp;
        }
        return blockCache[blockNumber];
    };

    // Collect results
    const results = [];
    for (const event of events) {
        const timestamp = await getBlockTimestamp(event.blockNumber);
        results.push({
            round: event.args.round,
            bidder: event.args.firstPriceBidder,
            controller: event.args.expressLaneController,
            price: event.args.price,
            block: event.blockNumber,
            tx: event.transactionHash,
            timestamp,
        });
    }

    // Display all results
    console.log("\n==================== AUCTION RESULTS ====================");
    results.forEach((r, index) => {
        const date = new Date(Number(r.timestamp) * 1000).toISOString();
        console.log(`\n--- Result ${index + 1} | Round ${r.round.toString()} ---`);
        console.log("Date:", date);
        console.log("Winning bidder:", r.bidder);
        console.log("Express lane controller:", r.controller);
        console.log("Price:", fmt(r.price), symbol);
        console.log("Block:", r.block);
        console.log("Tx:", r.tx);
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

    console.log("\n==================== SUMMARY ====================");
    console.log("Total auctions:", results.length);
    console.log("Total revenue:", fmt(totalRevenue), symbol);
    console.log("Average price:", fmt(avgPrice), symbol);
    console.log("Lowest price:", fmt(sorted[0]), symbol);
    console.log("Highest price:", fmt(sorted[sorted.length - 1]), symbol);
    console.log("Unique bidders:", uniqueBidders.length);
    console.log("Unique controllers:", uniqueControllers.length);

    console.log("\n==================== BIDDER LEADERBOARD ====================");
    Object.entries(bidderWins)
        .sort((a, b) => b[1] - a[1])
        .forEach(([addr, wins]) => {
            const spent = bidderSpend[addr];
            console.log(`  ${addr}`);
            console.log(`    Wins: ${wins} | Total spent: ${fmt(spent)} ${symbol} | Avg: ${fmt(spent / BigInt(wins))} ${symbol}`);
        });

    console.log("\n==================== CONTROLLER LEADERBOARD ====================");
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

    console.log("\n==================== DAILY BREAKDOWN ====================");
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
