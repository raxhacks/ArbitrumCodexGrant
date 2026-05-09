const { Web3 } = require("web3");

const RPC_URL = "https://arb1.arbitrum.io/rpc";
const CHAIN_ID = 42161;
const EXPRESS_LANE_AUCTION_ADDRESS = "0x5fcb496a31b7AE91e7c9078Ec662bd7A55cd3079";

const ERC20_ABI = [
    { name: "symbol", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "string" }] },
    { name: "decimals", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint8" }] },
];

const FALLBACK_ABI = [
    { name: "currentRound", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint64" }] },
    { name: "biddingToken", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
    { name: "resolvedRounds", type: "function", stateMutability: "view", inputs: [], outputs: [
        { name: "", type: "tuple", components: [
            { name: "expressLaneController", type: "address" },
            { name: "round", type: "uint64" },
        ]},
        { name: "", type: "tuple", components: [
            { name: "expressLaneController", type: "address" },
            { name: "round", type: "uint64" },
        ]},
    ]},
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
    { type: "event", name: "SetReservePrice", anonymous: false, inputs: [
        { indexed: false, name: "oldReservePrice", type: "uint256" },
        { indexed: false, name: "newReservePrice", type: "uint256" },
    ]},
    { type: "event", name: "Deposit", anonymous: false, inputs: [
        { indexed: true, name: "account", type: "address" },
        { indexed: false, name: "amount", type: "uint256" },
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

async function getTimeboostFullState() {
    const web3 = new Web3(RPC_URL);
    const abi = await loadAbi(web3, CHAIN_ID, EXPRESS_LANE_AUCTION_ADDRESS, FALLBACK_ABI);
    const auction = new web3.eth.Contract(abi, EXPRESS_LANE_AUCTION_ADDRESS);

    const biddingTokenAddress = await auction.methods.biddingToken().call();
    const tokenContract = new web3.eth.Contract(ERC20_ABI, biddingTokenAddress);
    const symbol = await tokenContract.methods.symbol().call();
    const decimals = Number(await tokenContract.methods.decimals().call());
    const fmt = (val) => {
        const s = val.toString().padStart(decimals + 1, "0");
        const w = s.slice(0, s.length - decimals) || "0";
        const f = s.slice(s.length - decimals).replace(/0+$/, "");
        return f ? `${w}.${f}` : w;
    };

    const currentBlock = Number(await web3.eth.getBlockNumber());
    const fromBlock = Math.max(0, currentBlock - 1_000_000);

    console.log("\nAUCTION HISTORY");
    console.log(`Querying from block ${fromBlock} to latest...`);
    const resolvedEvents = await auction.getPastEvents("AuctionResolved", { fromBlock, toBlock: "latest" });
    console.log("Total auctions resolved:", resolvedEvents.length);

    resolvedEvents.slice(0, 10).forEach((event) => {
        const a = event.returnValues;
        console.log(`\n--- Round ${a.round.toString()} ---`);
        console.log("Multi-bid auction:", a.isMultiBidAuction);
        console.log("First price bidder:", a.firstPriceBidder);
        console.log("Express lane controller:", a.firstPriceExpressLaneController);
        console.log("Winning bid:", fmt(a.firstPriceAmount), symbol);
        console.log("Settled price:", fmt(a.price), symbol);
    });
    if (resolvedEvents.length > 10) console.log(`(... ${resolvedEvents.length - 10} more rounds in history)`);

    console.log("\nRESERVE PRICE HISTORY");
    const reserveEvents = await auction.getPastEvents("SetReservePrice", { fromBlock, toBlock: "latest" });
    console.log("Total reserve price changes:", reserveEvents.length);
    reserveEvents.forEach((e) => {
        console.log(`  ${fmt(e.returnValues.oldReservePrice)} -> ${fmt(e.returnValues.newReservePrice)} ${symbol} (block ${e.blockNumber})`);
    });

    console.log("\nDEPOSIT HISTORY");
    const depositEvents = await auction.getPastEvents("Deposit", { fromBlock, toBlock: "latest" });
    console.log("Total deposits:", depositEvents.length);
    depositEvents.slice(0, 10).forEach((e) => {
        console.log(`  ${e.returnValues.account} | ${fmt(e.returnValues.amount)} ${symbol} (block ${e.blockNumber})`);
    });

    console.log("\nEXPRESS LANE CONTROLLERS (RECENT)");
    const currentRound = await auction.methods.currentRound().call();
    console.log("Current round:", currentRound.toString());
    const recent = await auction.methods.resolvedRounds().call();
    const r1 = recent[0] ?? recent.round1;
    const r2 = recent[1] ?? recent.round2;
    console.log(`  Round ${(r1.round ?? r1[1]).toString()}: ${r1.expressLaneController ?? r1[0]}`);
    console.log(`  Round ${(r2.round ?? r2[1]).toString()}: ${r2.expressLaneController ?? r2[0]}`);
}

getTimeboostFullState().catch((err) => {
    console.error("Error fetching Timeboost state:", err.message);
    process.exit(1);
});
