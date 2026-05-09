const { ethers } = require("ethers");

const RPC_URL = "https://arb1.arbitrum.io/rpc";
const CHAIN_ID = 42161;
const EXPRESS_LANE_AUCTION_ADDRESS = "0x5fcb496a31b7AE91e7c9078Ec662bd7A55cd3079";

const ERC20_ABI = [
    "function symbol() external view returns (string)",
    "function decimals() external view returns (uint8)",
];

const FALLBACK_ABI = [
    "function currentRound() external view returns (uint64)",
    "function reservePrice() external view returns (uint256)",
    "function biddingToken() external view returns (address)",
    "function resolvedRounds() external view returns (tuple(address expressLaneController, uint64 round) round1, tuple(address expressLaneController, uint64 round) round2)",
    "event AuctionResolved(bool indexed isMultiBidAuction, uint64 round, address indexed firstPriceBidder, address indexed firstPriceExpressLaneController, uint256 firstPriceAmount, uint256 price, uint64 roundStartTimestamp, uint64 roundEndTimestamp)",
    "event SetReservePrice(uint256 oldReservePrice, uint256 newReservePrice)",
    "event SetMinReservePrice(uint256 oldPrice, uint256 newPrice)",
    "event SetBeneficiary(address oldBeneficiary, address newBeneficiary)",
    "event Deposit(address indexed account, uint256 amount)",
    "event WithdrawalInitiated(address indexed account, uint256 withdrawalAmount, uint256 roundWithdrawable)",
    "event WithdrawalFinalized(address indexed account, uint256 withdrawalAmount)",
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

async function getTimeboostFullState() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const abi = await loadAbi(CHAIN_ID, EXPRESS_LANE_AUCTION_ADDRESS, provider, FALLBACK_ABI);
    const auction = new ethers.Contract(EXPRESS_LANE_AUCTION_ADDRESS, abi, provider);

    const biddingTokenAddress = await auction.biddingToken();
    const biddingToken = new ethers.Contract(biddingTokenAddress, ERC20_ABI, provider);
    const [symbol, decimals] = await Promise.all([biddingToken.symbol(), biddingToken.decimals()]);
    const fmt = (val) => ethers.formatUnits(val, decimals);

    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 1_000_000);

    console.log("\nAUCTION HISTORY");
    console.log(`Querying from block ${fromBlock} to latest...`);
    const resolvedEvents = await auction.queryFilter(auction.filters.AuctionResolved(), fromBlock, "latest");
    console.log("Total auctions resolved:", resolvedEvents.length);

    resolvedEvents.forEach((event) => {
        console.log(`\n--- Round ${event.args.round.toString()} ---`);
        console.log("Multi-bid auction:", event.args.isMultiBidAuction);
        console.log("First price bidder:", event.args.firstPriceBidder);
        console.log("Express lane controller:", event.args.firstPriceExpressLaneController);
        console.log("Winning bid:", fmt(event.args.firstPriceAmount), symbol);
        console.log("Settled price:", fmt(event.args.price), symbol);
        console.log("Block:", event.blockNumber, "| Tx:", event.transactionHash);
    });

    console.log("\nRESERVE PRICE HISTORY");
    const reserveEvents = await auction.queryFilter(auction.filters.SetReservePrice(), fromBlock, "latest");
    console.log("Total reserve price changes:", reserveEvents.length);
    reserveEvents.forEach((event) => {
        console.log(`  ${fmt(event.args.oldReservePrice)} -> ${fmt(event.args.newReservePrice)} ${symbol} (block ${event.blockNumber})`);
    });

    console.log("\nMIN RESERVE PRICE HISTORY");
    const minReserveEvents = await auction.queryFilter(auction.filters.SetMinReservePrice(), fromBlock, "latest");
    console.log("Total min reserve price changes:", minReserveEvents.length);
    minReserveEvents.forEach((event) => {
        console.log(`  ${fmt(event.args.oldPrice)} -> ${fmt(event.args.newPrice)} ${symbol} (block ${event.blockNumber})`);
    });

    console.log("\nBENEFICIARY HISTORY");
    const beneficiaryEvents = await auction.queryFilter(auction.filters.SetBeneficiary(), fromBlock, "latest");
    console.log("Total beneficiary changes:", beneficiaryEvents.length);
    beneficiaryEvents.forEach((event) => {
        console.log(`  ${event.args.oldBeneficiary} -> ${event.args.newBeneficiary} (block ${event.blockNumber})`);
    });

    console.log("\nDEPOSIT HISTORY");
    const depositEvents = await auction.queryFilter(auction.filters.Deposit(), fromBlock, "latest");
    console.log("Total deposits:", depositEvents.length);
    depositEvents.forEach((event) => {
        console.log(`  ${event.args.account} | ${fmt(event.args.amount)} ${symbol} (block ${event.blockNumber})`);
    });

    console.log("\nWITHDRAWAL HISTORY");
    const withdrawInit = await auction.queryFilter(auction.filters.WithdrawalInitiated(), fromBlock, "latest");
    console.log("Total withdrawals initiated:", withdrawInit.length);
    withdrawInit.forEach((event) => {
        console.log(`  ${event.args.account} | ${fmt(event.args.withdrawalAmount)} ${symbol} (round ${event.args.roundWithdrawable.toString()})`);
    });
    const withdrawFinal = await auction.queryFilter(auction.filters.WithdrawalFinalized(), fromBlock, "latest");
    console.log("Total withdrawals finalized:", withdrawFinal.length);
    withdrawFinal.forEach((event) => {
        console.log(`  ${event.args.account} | ${fmt(event.args.withdrawalAmount)} ${symbol} (block ${event.blockNumber})`);
    });

    console.log("\nEXPRESS LANE CONTROLLERS");
    const currentRound = await auction.currentRound();
    console.log("Current round:", currentRound.toString());

    const recent = await auction.resolvedRounds();
    const [r1, r2] = [recent[0] ?? recent.round1, recent[1] ?? recent.round2];
    console.log(`  Round ${(r1.round ?? r1[1]).toString()}: ${r1.expressLaneController ?? r1[0]}`);
    console.log(`  Round ${(r2.round ?? r2[1]).toString()}: ${r2.expressLaneController ?? r2[0]}`);

    // Older rounds: read from the event history we already pulled
    resolvedEvents.slice(-5).forEach((event) => {
        console.log(`  Round ${event.args.round.toString()}: ${event.args.firstPriceExpressLaneController} (from event)`);
    });
}

getTimeboostFullState().catch((err) => {
    console.error("Error fetching Timeboost state:", err.message);
    process.exit(1);
});
