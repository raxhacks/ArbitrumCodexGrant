const { Web3 } = require("web3");

const RPC_URL = "https://arb1.arbitrum.io/rpc";
const CHAIN_ID = 42161;
const EXPRESS_LANE_AUCTION_ADDRESS = "0x5fcb496a31b7AE91e7c9078Ec662bd7A55cd3079";

const FALLBACK_ABI = [
    { name: "currentRound", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint64" }] },
    { name: "roundTimingInfo", type: "function", stateMutability: "view", inputs: [], outputs: [
        { name: "offsetTimestamp", type: "int64" },
        { name: "roundDurationSeconds", type: "uint64" },
        { name: "auctionClosingSeconds", type: "uint64" },
        { name: "reserveSubmissionSeconds", type: "uint64" },
    ]},
    { name: "reservePrice", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
    { name: "minReservePrice", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
    { name: "beneficiary", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
    { name: "beneficiaryBalance", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
    { name: "biddingToken", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
    { name: "isAuctionRoundClosed", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "bool" }] },
    { name: "roundTimestamps", type: "function", stateMutability: "view", inputs: [{ name: "round", type: "uint64" }], outputs: [
        { name: "", type: "uint64" }, { name: "", type: "uint64" },
    ]},
];

const ERC20_ABI = [
    { name: "symbol", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "string" }] },
    { name: "decimals", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint8" }] },
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

async function getTimeboostCurrentState() {
    const web3 = new Web3(RPC_URL);
    const abi = await loadAbi(web3, CHAIN_ID, EXPRESS_LANE_AUCTION_ADDRESS, FALLBACK_ABI);
    const auction = new web3.eth.Contract(abi, EXPRESS_LANE_AUCTION_ADDRESS);

    console.log("TIMEBOOST CURRENT STATE");
    const currentRound = await auction.methods.currentRound().call();
    const timing = await auction.methods.roundTimingInfo().call();
    const reservePrice = await auction.methods.reservePrice().call();
    const minReservePrice = await auction.methods.minReservePrice().call();
    const beneficiary = await auction.methods.beneficiary().call();
    const beneficiaryBalance = await auction.methods.beneficiaryBalance().call();
    const biddingTokenAddr = await auction.methods.biddingToken().call();
    const isClosed = await auction.methods.isAuctionRoundClosed().call();

    const tokenContract = new web3.eth.Contract(ERC20_ABI, biddingTokenAddr);
    const tokenSymbol = await tokenContract.methods.symbol().call();
    const tokenDecimals = Number(await tokenContract.methods.decimals().call());
    const fmt = (val) => {
        const str = val.toString().padStart(tokenDecimals + 1, "0");
        const whole = str.slice(0, str.length - tokenDecimals) || "0";
        const frac = str.slice(str.length - tokenDecimals).replace(/0+$/, "");
        return frac ? `${whole}.${frac}` : whole;
    };

    const roundDuration = timing.roundDurationSeconds ?? timing[1];
    const auctionClosing = timing.auctionClosingSeconds ?? timing[2];
    const reserveSubmission = timing.reserveSubmissionSeconds ?? timing[3];

    console.log("Current round:", currentRound.toString());
    console.log("Round duration:", roundDuration.toString(), "seconds");
    console.log("Auction closing window:", auctionClosing.toString(), "seconds");
    console.log("Reserve submission window:", reserveSubmission.toString(), "seconds");
    console.log("Reserve price:", fmt(reservePrice), tokenSymbol);
    console.log("Min reserve price:", fmt(minReservePrice), tokenSymbol);
    console.log("Beneficiary:", beneficiary);
    console.log("Beneficiary balance:", fmt(beneficiaryBalance), tokenSymbol);
    console.log("Bidding token:", biddingTokenAddr, `(${tokenSymbol})`);
    console.log("Is auction round currently closed:", isClosed);

    console.log("\nCURRENT ROUND DETAILS");
    const timestamps = await auction.methods.roundTimestamps(currentRound).call();
    const tsStart = timestamps[0] ?? timestamps.start;
    const tsEnd = timestamps[1] ?? timestamps.end;
    console.log("Round start:", new Date(Number(tsStart) * 1000).toISOString());
    console.log("Round end:", new Date(Number(tsEnd) * 1000).toISOString());

    const nextRound = BigInt(currentRound) + 1n;
    const nextTimestamps = await auction.methods.roundTimestamps(nextRound.toString()).call();
    console.log("\nNEXT ROUND");
    console.log("Next round:", nextRound.toString());
    console.log("Round start:", new Date(Number(nextTimestamps[0] ?? nextTimestamps.start) * 1000).toISOString());
    console.log("Round end:", new Date(Number(nextTimestamps[1] ?? nextTimestamps.end) * 1000).toISOString());
}

getTimeboostCurrentState().catch((err) => {
    console.error("Error fetching Timeboost current state:", err.message);
    process.exit(1);
});
