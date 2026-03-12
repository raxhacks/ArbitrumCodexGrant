const { Web3 } = require("web3");

// ==================== CONFIGURATION ====================
const RPC_URL = "https://arb1.arbitrum.io/rpc";
const EXPRESS_LANE_AUCTION_ADDRESS = "0x00a0F15B79D1D3E5991929FaAbCf2Aa65623530d";
const HISTORY_ROUNDS = 100; // Number of past rounds to analyze
const WIN_PROBABILITY_TARGET = 0.8; // 80% win probability target

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
        name: "reservePrice",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
    },
    {
        name: "minReservePrice",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
    },
    {
        name: "roundDurationSeconds",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint64" }],
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
    const reserve = BigInt(reservePrice);
    const strategies = [];

    // Conservative: median price
    const conservative = analysis.median > reserve ? analysis.median : reserve;
    strategies.push({
        name: "CONSERVATIVE",
        description: "Median historical price, ~50% win rate",
        bid: conservative,
    });

    // Balanced: 75th percentile
    const balanced = analysis.p75 > reserve ? analysis.p75 : reserve;
    strategies.push({
        name: "BALANCED",
        description: "75th percentile, ~75% win rate",
        bid: balanced,
    });

    // Aggressive: 90th percentile
    const aggressive = analysis.p90 > reserve ? analysis.p90 : reserve;
    strategies.push({
        name: "AGGRESSIVE",
        description: "90th percentile, ~90% win rate",
        bid: aggressive,
    });

    // Target probability bid
    const targetBid = (() => {
        const zAdjust = analysis.stdDev * 84n / 100n;
        const bid = analysis.mean + zAdjust;
        return bid > reserve ? bid : reserve;
    })();

    strategies.push({
        name: `TARGET (${(WIN_PROBABILITY_TARGET * 100).toFixed(0)}% WIN RATE)`,
        description: `Estimated bid for ${(WIN_PROBABILITY_TARGET * 100).toFixed(0)}% probability of winning`,
        bid: targetBid,
    });

    // Minimum viable: just above reserve
    const minViable = reserve + (reserve / 100n);
    strategies.push({
        name: "MINIMUM VIABLE",
        description: "Just above reserve price, lowest cost but low win rate",
        bid: minViable,
    });

    // Trend-adjusted
    let trendAdjusted = analysis.p75;
    if (analysis.trend.includes("RISING")) {
        trendAdjusted = analysis.p90;
    } else if (analysis.trend.includes("FALLING")) {
        trendAdjusted = analysis.median;
    }
    trendAdjusted = trendAdjusted > reserve ? trendAdjusted : reserve;

    strategies.push({
        name: "TREND-ADJUSTED",
        description: `Adjusted for current trend: ${analysis.trend}`,
        bid: trendAdjusted,
    });

    return strategies;
}

// ==================== MAIN ====================
async function calculateOptimalTimeboostBid() {
    const web3 = new Web3(RPC_URL);
    const auction = new web3.eth.Contract(EXPRESS_LANE_AUCTION_ABI, EXPRESS_LANE_AUCTION_ADDRESS);

    const currentRound = await auction.methods.currentRound().call();
    const reservePrice = await auction.methods.reservePrice().call();
    const minReservePrice = await auction.methods.minReservePrice().call();
    const roundDuration = await auction.methods.roundDurationSeconds().call();
    const biddingTokenAddress = await auction.methods.biddingToken().call();

    const biddingToken = new web3.eth.Contract(ERC20_ABI, biddingTokenAddress);
    const symbol = await biddingToken.methods.symbol().call();
    const tokenDecimals = Number(await biddingToken.methods.decimals().call());

    const fmt = (val) => {
        const str = val.toString().padStart(tokenDecimals + 1, "0");
        const whole = str.slice(0, str.length - tokenDecimals) || "0";
        const frac = str.slice(str.length - tokenDecimals).replace(/0+$/, "");
        return frac ? `${whole}.${frac}` : whole;
    };

    console.log("==================== AUCTION INFO ====================");
    console.log("Current round:", currentRound.toString());
    console.log("Bidding token:", biddingTokenAddress, `(${symbol})`);
    console.log("Reserve price:", fmt(reservePrice), symbol);
    console.log("Min reserve price:", fmt(minReservePrice), symbol);
    console.log("Round duration:", roundDuration.toString(), "seconds");

    // Fetch historical auction data
    console.log(`\n==================== FETCHING HISTORY (last ${HISTORY_ROUNDS} rounds) ====================`);
    const currentBlock = Number(await web3.eth.getBlockNumber());
    const fromBlock = Math.max(0, currentBlock - 1_000_000);
    const events = await auction.getPastEvents("AuctionResolved", { fromBlock, toBlock: "latest" });
    console.log("Total historical auctions found:", events.length);

    const recentEvents = events.slice(-HISTORY_ROUNDS);
    const prices = recentEvents.map((e) => BigInt(e.returnValues.price));

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
