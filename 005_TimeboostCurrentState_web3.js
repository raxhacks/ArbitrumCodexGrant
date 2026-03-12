const { Web3 } = require("web3");

// ==================== CONFIGURATION ====================
const RPC_URL = "https://arb1.arbitrum.io/rpc";
const EXPRESS_LANE_AUCTION_ADDRESS = "0x00a0F15B79D1D3E5991929FaAbCf2Aa65623530d";

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
        name: "roundDurationSeconds",
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
        name: "beneficiary",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "address" }],
    },
    {
        name: "beneficiaryBalance",
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
        name: "auctioneer",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "address" }],
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

// ==================== MAIN ====================
async function getTimeboostCurrentState() {
    const web3 = new Web3(RPC_URL);
    const auction = new web3.eth.Contract(EXPRESS_LANE_AUCTION_ABI, EXPRESS_LANE_AUCTION_ADDRESS);

    console.log("==================== TIMEBOOST CURRENT STATE ====================");
    const currentRound = await auction.methods.currentRound().call();
    const roundDuration = await auction.methods.roundDurationSeconds().call();
    const reservePrice = await auction.methods.reservePrice().call();
    const minReservePrice = await auction.methods.minReservePrice().call();
    const beneficiary = await auction.methods.beneficiary().call();
    const beneficiaryBalance = await auction.methods.beneficiaryBalance().call();
    const biddingTokenAddr = await auction.methods.biddingToken().call();
    const auctioneer = await auction.methods.auctioneer().call();

    // Fetch bidding token info for proper formatting
    const tokenContract = new web3.eth.Contract(ERC20_ABI, biddingTokenAddr);
    const tokenSymbol = await tokenContract.methods.symbol().call();
    const tokenDecimals = Number(await tokenContract.methods.decimals().call());
    const fmt = (val) => {
        const str = val.toString().padStart(tokenDecimals + 1, "0");
        const whole = str.slice(0, str.length - tokenDecimals) || "0";
        const frac = str.slice(str.length - tokenDecimals).replace(/0+$/, "");
        return frac ? `${whole}.${frac}` : whole;
    };

    console.log("Current round:", currentRound.toString());
    console.log("Round duration:", roundDuration.toString(), "seconds");
    console.log("Reserve price:", fmt(reservePrice), tokenSymbol);
    console.log("Min reserve price:", fmt(minReservePrice), tokenSymbol);
    console.log("Beneficiary:", beneficiary);
    console.log("Beneficiary balance:", fmt(beneficiaryBalance), tokenSymbol);
    console.log("Bidding token:", biddingTokenAddr, `(${tokenSymbol})`);
    console.log("Auctioneer:", auctioneer);

    // Current round details
    console.log("\n==================== CURRENT ROUND DETAILS ====================");
    const controller = await auction.methods.expressLaneControllerByRound(currentRound).call();
    const timestamps = await auction.methods.roundTimestamps(currentRound).call();

    console.log("Express lane controller:", controller);
    console.log("Round start:", new Date(Number(timestamps.start) * 1000).toISOString());
    console.log("Round end:", new Date(Number(timestamps.end) * 1000).toISOString());

    // Next round
    const nextRound = BigInt(currentRound) + 1n;
    const nextController = await auction.methods.expressLaneControllerByRound(nextRound).call();
    const nextTimestamps = await auction.methods.roundTimestamps(nextRound).call();

    console.log("\n==================== NEXT ROUND DETAILS ====================");
    console.log("Next round:", nextRound.toString());
    console.log("Express lane controller:", nextController);
    console.log("Round start:", new Date(Number(nextTimestamps.start) * 1000).toISOString());
    console.log("Round end:", new Date(Number(nextTimestamps.end) * 1000).toISOString());
}

getTimeboostCurrentState().catch((err) => {
    console.error("Error fetching Timeboost current state:", err.message);
    process.exit(1);
});
