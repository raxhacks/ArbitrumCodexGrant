const { ethers } = require("ethers");

// ==================== CONFIGURATION ====================
const RPC_URL = "https://arb1.arbitrum.io/rpc";
const EXPRESS_LANE_AUCTION_ADDRESS = "0x00a0F15B79D1D3E5991929FaAbCf2Aa65623530d";

// ==================== ABI ====================
const EXPRESS_LANE_AUCTION_ABI = [
    "function currentRound() external view returns (uint64)",
    "function roundDurationSeconds() external view returns (uint64)",
    "function reservePrice() external view returns (uint256)",
    "function minReservePrice() external view returns (uint256)",
    "function beneficiary() external view returns (address)",
    "function beneficiaryBalance() external view returns (uint256)",
    "function biddingToken() external view returns (address)",
    "function auctioneer() external view returns (address)",
    "function expressLaneControllerByRound(uint64 round) external view returns (address)",
    "function roundTimestamps(uint64 round) external view returns (uint64 start, uint64 end)",
    "event AuctionResolved(uint64 indexed round, address indexed firstPriceBidder, address indexed expressLaneController, uint256 price)",
    "event SetReservePrice(uint256 oldReservePrice, uint256 newReservePrice)",
    "event SetMinReservePrice(uint256 oldPrice, uint256 newPrice)",
    "event SetBeneficiary(address oldBeneficiary, address newBeneficiary)",
    "event Deposit(address indexed sender, uint256 amount)",
    "event WithdrawalInitiated(address indexed sender, uint256 amount)",
    "event WithdrawalFinalized(address indexed sender, uint256 amount)",
];

const ERC20_ABI = [
    "function symbol() external view returns (string)",
    "function decimals() external view returns (uint8)",
];

// ==================== MAIN ====================
async function getTimeboostFullState() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const auction = new ethers.Contract(EXPRESS_LANE_AUCTION_ADDRESS, EXPRESS_LANE_AUCTION_ABI, provider);

    // Fetch bidding token info for proper formatting
    const biddingTokenAddress = await auction.biddingToken();
    const biddingToken = new ethers.Contract(biddingTokenAddress, ERC20_ABI, provider);
    const [symbol, decimals] = await Promise.all([biddingToken.symbol(), biddingToken.decimals()]);
    const fmt = (val) => ethers.formatUnits(val, decimals);

    // Use a recent block range (public RPCs limit log query range, typically ~100k blocks)
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 1_000_000);

    // ---- All Auction Resolved Events (full history) ----
    console.log("\n==================== AUCTION HISTORY ====================");
    console.log(`Querying from block ${fromBlock} to latest...`);
    const resolvedFilter = auction.filters.AuctionResolved();
    const resolvedEvents = await auction.queryFilter(resolvedFilter, fromBlock, "latest");
    console.log("Total auctions resolved:", resolvedEvents.length);

    resolvedEvents.forEach((event) => {
        console.log(`\n--- Round ${event.args.round.toString()} ---`);
        console.log("First price bidder:", event.args.firstPriceBidder);
        console.log("Express lane controller:", event.args.expressLaneController);
        console.log("Price:", fmt(event.args.price), symbol);
        console.log("Block:", event.blockNumber);
        console.log("Tx:", event.transactionHash);
    });

    // ---- Reserve Price Changes ----
    console.log("\n==================== RESERVE PRICE HISTORY ====================");
    const reserveFilter = auction.filters.SetReservePrice();
    const reserveEvents = await auction.queryFilter(reserveFilter, fromBlock, "latest");
    console.log("Total reserve price changes:", reserveEvents.length);

    reserveEvents.forEach((event) => {
        console.log(`\n  Old: ${fmt(event.args.oldReservePrice)} ${symbol} -> New: ${fmt(event.args.newReservePrice)} ${symbol} (block ${event.blockNumber})`);
    });

    // ---- Min Reserve Price Changes ----
    console.log("\n==================== MIN RESERVE PRICE HISTORY ====================");
    const minReserveFilter = auction.filters.SetMinReservePrice();
    const minReserveEvents = await auction.queryFilter(minReserveFilter, fromBlock, "latest");
    console.log("Total min reserve price changes:", minReserveEvents.length);

    minReserveEvents.forEach((event) => {
        console.log(`\n  Old: ${fmt(event.args.oldPrice)} ${symbol} -> New: ${fmt(event.args.newPrice)} ${symbol} (block ${event.blockNumber})`);
    });

    // ---- Beneficiary Changes ----
    console.log("\n==================== BENEFICIARY HISTORY ====================");
    const beneficiaryFilter = auction.filters.SetBeneficiary();
    const beneficiaryEvents = await auction.queryFilter(beneficiaryFilter, fromBlock, "latest");
    console.log("Total beneficiary changes:", beneficiaryEvents.length);

    beneficiaryEvents.forEach((event) => {
        console.log(`\n  Old: ${event.args.oldBeneficiary} -> New: ${event.args.newBeneficiary} (block ${event.blockNumber})`);
    });

    // ---- Deposit History ----
    console.log("\n==================== DEPOSIT HISTORY ====================");
    const depositFilter = auction.filters.Deposit();
    const depositEvents = await auction.queryFilter(depositFilter, fromBlock, "latest");
    console.log("Total deposits:", depositEvents.length);

    depositEvents.forEach((event) => {
        console.log(`  Sender: ${event.args.sender} | Amount: ${fmt(event.args.amount)} ${symbol} (block ${event.blockNumber})`);
    });

    // ---- Withdrawal History ----
    console.log("\n==================== WITHDRAWAL HISTORY ====================");
    const withdrawInitFilter = auction.filters.WithdrawalInitiated();
    const withdrawInitEvents = await auction.queryFilter(withdrawInitFilter, fromBlock, "latest");
    console.log("Total withdrawals initiated:", withdrawInitEvents.length);

    withdrawInitEvents.forEach((event) => {
        console.log(`  Sender: ${event.args.sender} | Amount: ${fmt(event.args.amount)} ${symbol} (block ${event.blockNumber})`);
    });

    const withdrawFinalFilter = auction.filters.WithdrawalFinalized();
    const withdrawFinalEvents = await auction.queryFilter(withdrawFinalFilter, fromBlock, "latest");
    console.log("Total withdrawals finalized:", withdrawFinalEvents.length);

    withdrawFinalEvents.forEach((event) => {
        console.log(`  Sender: ${event.args.sender} | Amount: ${fmt(event.args.amount)} ${symbol} (block ${event.blockNumber})`);
    });

    // ---- Express Lane Controllers Per Round (from resolved events) ----
    console.log("\n==================== EXPRESS LANE CONTROLLERS ====================");
    const currentRound = await auction.currentRound();
    console.log("Current round:", currentRound.toString());

    // Use resolved events instead of querying every round individually
    resolvedEvents.forEach((event) => {
        console.log(`  Round ${event.args.round.toString()}: ${event.args.expressLaneController}`);
    });

    // Also check the current round's controller
    const currentController = await auction.expressLaneControllerByRound(currentRound);
    if (currentController !== ethers.ZeroAddress) {
        console.log(`  Round ${currentRound.toString()} (current): ${currentController}`);
    }
}

getTimeboostFullState().catch((err) => {
    console.error("Error fetching Timeboost state:", err.message);
    process.exit(1);
});
