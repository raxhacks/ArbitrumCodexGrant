const { ethers } = require("ethers");

// ==================== CONFIGURATION ====================
const RPC_URL = "https://arb1.arbitrum.io/rpc";
const EXPRESS_LANE_AUCTION_ADDRESS = "0x00a0F15B79D1D3E5991929FaAbCf2Aa65623530d";
const HISTORY_ROUNDS = 100; // Number of past rounds to analyze
const WIN_PROBABILITY_TARGET = 0.8; // 80% win probability target

// ==================== ABI ====================
const EXPRESS_LANE_AUCTION_ABI = [
    "function currentRound() external view returns (uint64)",
    "function reservePrice() external view returns (uint256)",
    "function minReservePrice() external view returns (uint256)",
    "function roundDurationSeconds() external view returns (uint64)",
    "function biddingToken() external view returns (address)",
    "event AuctionResolved(uint64 indexed round, address indexed firstPriceBidder, address indexed expressLaneController, uint256 price)",
];

const ERC20_ABI = [
    "function symbol() external view returns (string)",
    "function decimals() external view returns (uint8)",
];

// ==================== ANALYSIS ====================
function analyzeHistory(prices) {
    if (prices.length === 0) return null;

    const sorted = [...prices].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const count = sorted.length;

    const sum = sorted.reduce((acc, p) => acc + p, 0n);
    const mean = sum / BigInt(count);

    const median = count % 2 === 0
        ? (sorted[count / 2 - 1] + sorted[count / 2]) / 2n
        : sorted[Math.floor(count / 2)];

    const min = sorted[0];
    const max = sorted[count - 1];

    // Standard deviation (approximate with BigInt)
    const squaredDiffs = sorted.map((p) => {
        const diff = p > mean ? p - mean : mean - p;
        return diff * diff;
    });
    const avgSquaredDiff = squaredDiffs.reduce((acc, d) => acc + d, 0n) / BigInt(count);
    // Integer square root approximation
    let stdDev = 0n;
    if (avgSquaredDiff > 0n) {
        let x = avgSquaredDiff;
        let y = (x + 1n) / 2n;
        while (y < x) {
            x = y;
            y = (x + avgSquaredDiff / x) / 2n;
        }
        stdDev = x;
    }

    // Percentiles
    const p25 = sorted[Math.floor(count * 0.25)];
    const p75 = sorted[Math.floor(count * 0.75)];
    const p90 = sorted[Math.floor(count * 0.90)];
    const p95 = sorted[Math.floor(count * 0.95)];

    // Trend analysis (last 10 vs previous)
    let trend = "STABLE";
    if (prices.length >= 20) {
        const recent = prices.slice(-10);
        const previous = prices.slice(-20, -10);
        const recentAvg = recent.reduce((a, b) => a + b, 0n) / 10n;
        const previousAvg = previous.reduce((a, b) => a + b, 0n) / 10n;

        if (previousAvg > 0n) {
            const changePercent = Number((recentAvg - previousAvg) * 10000n / previousAvg) / 100;
            if (changePercent > 10) trend = `RISING (+${changePercent.toFixed(1)}%)`;
            else if (changePercent < -10) trend = `FALLING (${changePercent.toFixed(1)}%)`;
            else trend = `STABLE (${changePercent > 0 ? "+" : ""}${changePercent.toFixed(1)}%)`;
        }
    }

    // Volatility (coefficient of variation)
    const volatility = mean > 0n ? Number(stdDev * 10000n / mean) / 100 : 0;

    return { mean, median, min, max, stdDev, p25, p75, p90, p95, trend, volatility, count };
}

function calculateOptimalBids(analysis, reservePrice) {
    const strategies = [];

    // Conservative: median price (moderate win rate)
    const conservative = analysis.median > reservePrice ? analysis.median : reservePrice;
    strategies.push({
        name: "CONSERVATIVE",
        description: "Median historical price, ~50% win rate",
        bid: conservative,
    });

    // Balanced: 75th percentile (good win rate)
    const balanced = analysis.p75 > reservePrice ? analysis.p75 : reservePrice;
    strategies.push({
        name: "BALANCED",
        description: "75th percentile, ~75% win rate",
        bid: balanced,
    });

    // Aggressive: 90th percentile (high win rate)
    const aggressive = analysis.p90 > reservePrice ? analysis.p90 : reservePrice;
    strategies.push({
        name: "AGGRESSIVE",
        description: "90th percentile, ~90% win rate",
        bid: aggressive,
    });

    // Target probability bid (interpolated)
    const targetIndex = Math.floor(analysis.count * WIN_PROBABILITY_TARGET);
    const sorted = [analysis.min, analysis.p25, analysis.median, analysis.p75, analysis.p90, analysis.p95, analysis.max];
    const targetBid = analysis.count > 0
        ? (() => {
            // Use mean + (stdDev * z-score approximation)
            // For 80%: z ≈ 0.84
            const zAdjust = analysis.stdDev * 84n / 100n;
            const bid = analysis.mean + zAdjust;
            return bid > reservePrice ? bid : reservePrice;
        })()
        : reservePrice;

    strategies.push({
        name: `TARGET (${(WIN_PROBABILITY_TARGET * 100).toFixed(0)}% WIN RATE)`,
        description: `Estimated bid for ${(WIN_PROBABILITY_TARGET * 100).toFixed(0)}% probability of winning`,
        bid: targetBid,
    });

    // Minimum viable: just above reserve
    const minViable = reservePrice + (reservePrice / 100n); // reserve + 1%
    strategies.push({
        name: "MINIMUM VIABLE",
        description: "Just above reserve price, lowest cost but low win rate",
        bid: minViable,
    });

    // Trend-adjusted: adjust based on recent trend
    let trendAdjusted = analysis.p75;
    if (analysis.trend.includes("RISING")) {
        trendAdjusted = analysis.p90; // Bid higher if prices are rising
    } else if (analysis.trend.includes("FALLING")) {
        trendAdjusted = analysis.median; // Bid lower if prices are falling
    }
    trendAdjusted = trendAdjusted > reservePrice ? trendAdjusted : reservePrice;

    strategies.push({
        name: "TREND-ADJUSTED",
        description: `Adjusted for current trend: ${analysis.trend}`,
        bid: trendAdjusted,
    });

    return strategies;
}

// ==================== MAIN ====================
async function calculateOptimalTimeboostBid() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const auction = new ethers.Contract(EXPRESS_LANE_AUCTION_ADDRESS, EXPRESS_LANE_AUCTION_ABI, provider);

    const [currentRound, reservePrice, minReservePrice, roundDuration, biddingTokenAddress] = await Promise.all([
        auction.currentRound(), auction.reservePrice(), auction.minReservePrice(),
        auction.roundDurationSeconds(), auction.biddingToken(),
    ]);

    const biddingToken = new ethers.Contract(biddingTokenAddress, ERC20_ABI, provider);
    const [symbol, decimals] = await Promise.all([biddingToken.symbol(), biddingToken.decimals()]);
    const fmt = (val) => ethers.formatUnits(val, decimals);

    console.log("==================== AUCTION INFO ====================");
    console.log("Current round:", currentRound.toString());
    console.log("Bidding token:", biddingTokenAddress, `(${symbol})`);
    console.log("Reserve price:", fmt(reservePrice), symbol);
    console.log("Min reserve price:", fmt(minReservePrice), symbol);
    console.log("Round duration:", roundDuration.toString(), "seconds");

    // Fetch historical auction data
    console.log(`\n==================== FETCHING HISTORY (last ${HISTORY_ROUNDS} rounds) ====================`);
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 1_000_000);
    const filter = auction.filters.AuctionResolved();
    const events = await auction.queryFilter(filter, fromBlock, "latest");
    console.log("Total historical auctions found:", events.length);

    const recentEvents = events.slice(-HISTORY_ROUNDS);
    const prices = recentEvents.map((e) => e.args.price);

    if (prices.length === 0) {
        console.log("\nNo historical auction data found. Using reserve price as baseline.");
        console.log("Recommended bid:", fmt(reservePrice), symbol);
        return;
    }

    console.log("Analyzing last", prices.length, "auctions...");

    // Run analysis
    const analysis = analyzeHistory(prices);

    console.log("\n==================== PRICE ANALYSIS ====================");
    console.log("Sample size:", analysis.count);
    console.log("Mean:", fmt(analysis.mean), symbol);
    console.log("Median:", fmt(analysis.median), symbol);
    console.log("Min:", fmt(analysis.min), symbol);
    console.log("Max:", fmt(analysis.max), symbol);
    console.log("Std deviation:", fmt(analysis.stdDev), symbol);
    console.log("25th percentile:", fmt(analysis.p25), symbol);
    console.log("75th percentile:", fmt(analysis.p75), symbol);
    console.log("90th percentile:", fmt(analysis.p90), symbol);
    console.log("95th percentile:", fmt(analysis.p95), symbol);
    console.log("Trend:", analysis.trend);
    console.log("Volatility:", analysis.volatility.toFixed(2) + "%");

    // Calculate optimal bids
    const strategies = calculateOptimalBids(analysis, reservePrice);

    console.log("\n==================== OPTIMAL BID STRATEGIES ====================");
    strategies.forEach((s) => {
        console.log(`\n--- ${s.name} ---`);
        console.log("Description:", s.description);
        console.log("Recommended bid:", fmt(s.bid), symbol);
    });

    // Final recommendation
    console.log("\n==================== RECOMMENDATION ====================");
    const recommended = strategies.find((s) => s.name === "TREND-ADJUSTED");
    console.log("Based on current market conditions:");
    console.log("Trend:", analysis.trend);
    console.log("Volatility:", analysis.volatility > 50 ? "HIGH" : analysis.volatility > 25 ? "MEDIUM" : "LOW");
    console.log("");
    console.log(`>>> Recommended bid: ${fmt(recommended.bid)} ${symbol} <<<`);

    if (analysis.volatility > 50) {
        console.log("\nWARNING: High volatility detected. Consider using the AGGRESSIVE strategy");
        console.log("or monitoring prices closely before bidding.");
    }
}

calculateOptimalTimeboostBid().catch((err) => {
    console.error("Error calculating optimal bid:", err.message);
    process.exit(1);
});
