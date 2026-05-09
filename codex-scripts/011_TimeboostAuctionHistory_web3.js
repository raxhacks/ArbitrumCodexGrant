const { Web3 } = require("web3");

const RPC_URL = "https://arb1.arbitrum.io/rpc";
const CHAIN_ID = 42161;
const EXPRESS_LANE_AUCTION_ADDRESS = "0x5fcb496a31b7AE91e7c9078Ec662bd7A55cd3079";
let FROM_BLOCK = 0;
const TO_BLOCK = "latest";
const FILTER_BIDDER = "";
const FILTER_CONTROLLER = "";

const FALLBACK_ABI = [
    { name: "currentRound", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint64" }] },
    { name: "reservePrice", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
    { name: "roundTimingInfo", type: "function", stateMutability: "view", inputs: [], outputs: [
        { name: "offsetTimestamp", type: "int64" },
        { name: "roundDurationSeconds", type: "uint64" },
        { name: "auctionClosingSeconds", type: "uint64" },
        { name: "reserveSubmissionSeconds", type: "uint64" },
    ]},
    { name: "biddingToken", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
    { type: "event", name: "AuctionResolved", anonymous: false, inputs: [
        { indexed: true, name: "isMultiBidAuction", type: "bool" },
        { indexed: false, name: "round", type: "uint64" },
        { indexed: true, name: "firstPriceBidder", type: "address" },
        { indexed: true, name: "firstPriceExpressLaneController", type: "address" },
        { indexed: false, name: "firstPriceAmount", type: "uint256" },
        { indexed: false, name: "price", type: "uint256" },
        { indexed: false, name: "roundStartTimestamp", type: "uint64" },
        { indexed: false, name: "roundEndTimestamp", type: "uint64" },
    ]},
];

async function loadAbi(web3, chainId, address, fallback) {
    try {
        const slot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
        const raw = await web3.eth.getStorageAt(address, slot);
        const impl = raw && raw !== "0x" ? "0x" + raw.toString().slice(-40) : null;
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

async function readAuctionHistory() {
    const web3 = new Web3(RPC_URL);
    const abi = await loadAbi(web3, CHAIN_ID, EXPRESS_LANE_AUCTION_ADDRESS, FALLBACK_ABI);
    const auction = new web3.eth.Contract(abi, EXPRESS_LANE_AUCTION_ADDRESS);

    const currentRound = await auction.methods.currentRound().call();
    const reservePrice = await auction.methods.reservePrice().call();
    const timing = await auction.methods.roundTimingInfo().call();
    const roundDuration = timing.roundDurationSeconds ?? timing[1];
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

    console.log("AUCTION INFO");
    console.log("Current round:", currentRound.toString());
    console.log("Bidding token:", biddingTokenAddress, `(${symbol})`);
    console.log("Reserve price:", fmt(reservePrice), symbol);
    console.log("Round duration:", roundDuration.toString(), "seconds");

    if (FROM_BLOCK === 0) {
        const currentBlock = Number(await web3.eth.getBlockNumber());
        FROM_BLOCK = Math.max(0, currentBlock - 1000);
    }

    const filterOpts = { fromBlock: FROM_BLOCK, toBlock: TO_BLOCK };
    if (FILTER_BIDDER) filterOpts.filter = { ...filterOpts.filter, firstPriceBidder: FILTER_BIDDER };
    if (FILTER_CONTROLLER) filterOpts.filter = { ...filterOpts.filter, firstPriceExpressLaneController: FILTER_CONTROLLER };

    console.log("\nFETCHING AUCTION HISTORY");
    console.log("From block:", FROM_BLOCK);
    console.log("To block:", TO_BLOCK);
    if (FILTER_BIDDER) console.log("Filtering by bidder:", FILTER_BIDDER);
    if (FILTER_CONTROLLER) console.log("Filtering by controller:", FILTER_CONTROLLER);

    const allEvents = await auction.getPastEvents("AuctionResolved", filterOpts);
    console.log("Total auction results found:", allEvents.length);

    if (allEvents.length === 0) {
        console.log("\nNo auction results found.");
        return;
    }

    const events = allEvents.slice(-200);

    const results = events.map((event) => ({
        round: event.returnValues.round,
        bidder: event.returnValues.firstPriceBidder,
        controller: event.returnValues.firstPriceExpressLaneController,
        price: BigInt(event.returnValues.price),
        block: Number(event.blockNumber),
        tx: event.transactionHash,
        timestamp: Number(event.returnValues.roundStartTimestamp),
    }));

    // Display the most recent 50 results
    console.log("\nAUCTION RESULTS (most recent 50)");
    results.slice(-50).forEach((r, index) => {
        const date = new Date(r.timestamp * 1000).toISOString();
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
        const day = new Date(r.timestamp * 1000).toISOString().split("T")[0];
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
