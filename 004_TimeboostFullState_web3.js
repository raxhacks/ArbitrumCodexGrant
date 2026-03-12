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
    {
        name: "SetReservePrice",
        type: "event",
        inputs: [
            { name: "oldReservePrice", type: "uint256", indexed: false },
            { name: "newReservePrice", type: "uint256", indexed: false },
        ],
    },
    {
        name: "SetMinReservePrice",
        type: "event",
        inputs: [
            { name: "oldPrice", type: "uint256", indexed: false },
            { name: "newPrice", type: "uint256", indexed: false },
        ],
    },
    {
        name: "SetBeneficiary",
        type: "event",
        inputs: [
            { name: "oldBeneficiary", type: "address", indexed: false },
            { name: "newBeneficiary", type: "address", indexed: false },
        ],
    },
    {
        name: "Deposit",
        type: "event",
        inputs: [
            { name: "sender", type: "address", indexed: true },
            { name: "amount", type: "uint256", indexed: false },
        ],
    },
    {
        name: "WithdrawalInitiated",
        type: "event",
        inputs: [
            { name: "sender", type: "address", indexed: true },
            { name: "amount", type: "uint256", indexed: false },
        ],
    },
    {
        name: "WithdrawalFinalized",
        type: "event",
        inputs: [
            { name: "sender", type: "address", indexed: true },
            { name: "amount", type: "uint256", indexed: false },
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
async function getTimeboostFullState() {
    const web3 = new Web3(RPC_URL);
    const auction = new web3.eth.Contract(EXPRESS_LANE_AUCTION_ABI, EXPRESS_LANE_AUCTION_ADDRESS);

    // Fetch bidding token info for proper formatting
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

    // Use a recent block range (public RPCs limit log query range)
    const currentBlock = Number(await web3.eth.getBlockNumber());
    const fromBlock = Math.max(0, currentBlock - 1_000_000);

    // ---- Auction Resolved Events ----
    console.log("\n==================== AUCTION HISTORY ====================");
    console.log(`Querying from block ${fromBlock} to latest...`);
    const resolvedEvents = await auction.getPastEvents("AuctionResolved", { fromBlock: fromBlock, toBlock: "latest" });
    console.log("Total auctions resolved:", resolvedEvents.length);

    resolvedEvents.forEach((event) => {
        const { round, firstPriceBidder, expressLaneController, price } = event.returnValues;
        console.log(`\n--- Round ${round.toString()} ---`);
        console.log("First price bidder:", firstPriceBidder);
        console.log("Express lane controller:", expressLaneController);
        console.log("Price:", fmt(price), symbol);
        console.log("Block:", event.blockNumber.toString());
        console.log("Tx:", event.transactionHash);
    });

    // ---- Reserve Price Changes ----
    console.log("\n==================== RESERVE PRICE HISTORY ====================");
    const reserveEvents = await auction.getPastEvents("SetReservePrice", { fromBlock: fromBlock, toBlock: "latest" });
    console.log("Total reserve price changes:", reserveEvents.length);

    reserveEvents.forEach((event) => {
        const { oldReservePrice: oldP, newReservePrice: newP } = event.returnValues;
        console.log(`\n  Old: ${fmt(oldP)} ${symbol} -> New: ${fmt(newP)} ${symbol} (block ${event.blockNumber.toString()})`);
    });

    // ---- Min Reserve Price Changes ----
    console.log("\n==================== MIN RESERVE PRICE HISTORY ====================");
    const minReserveEvents = await auction.getPastEvents("SetMinReservePrice", { fromBlock: fromBlock, toBlock: "latest" });
    console.log("Total min reserve price changes:", minReserveEvents.length);

    minReserveEvents.forEach((event) => {
        const { oldPrice, newPrice } = event.returnValues;
        console.log(`\n  Old: ${fmt(oldPrice)} ${symbol} -> New: ${fmt(newPrice)} ${symbol} (block ${event.blockNumber.toString()})`);
    });

    // ---- Beneficiary Changes ----
    console.log("\n==================== BENEFICIARY HISTORY ====================");
    const beneficiaryEvents = await auction.getPastEvents("SetBeneficiary", { fromBlock: fromBlock, toBlock: "latest" });
    console.log("Total beneficiary changes:", beneficiaryEvents.length);

    beneficiaryEvents.forEach((event) => {
        const { oldBeneficiary: oldB, newBeneficiary: newB } = event.returnValues;
        console.log(`\n  Old: ${oldB} -> New: ${newB} (block ${event.blockNumber.toString()})`);
    });

    // ---- Deposit History ----
    console.log("\n==================== DEPOSIT HISTORY ====================");
    const depositEvents = await auction.getPastEvents("Deposit", { fromBlock: fromBlock, toBlock: "latest" });
    console.log("Total deposits:", depositEvents.length);

    depositEvents.forEach((event) => {
        const { sender, amount } = event.returnValues;
        console.log(`  Sender: ${sender} | Amount: ${fmt(amount)} ${symbol} (block ${event.blockNumber.toString()})`);
    });

    // ---- Withdrawal History ----
    console.log("\n==================== WITHDRAWAL HISTORY ====================");
    const withdrawInitEvents = await auction.getPastEvents("WithdrawalInitiated", { fromBlock: fromBlock, toBlock: "latest" });
    console.log("Total withdrawals initiated:", withdrawInitEvents.length);

    withdrawInitEvents.forEach((event) => {
        const { sender, amount } = event.returnValues;
        console.log(`  Sender: ${sender} | Amount: ${fmt(amount)} ${symbol} (block ${event.blockNumber.toString()})`);
    });

    const withdrawFinalEvents = await auction.getPastEvents("WithdrawalFinalized", { fromBlock: fromBlock, toBlock: "latest" });
    console.log("Total withdrawals finalized:", withdrawFinalEvents.length);

    withdrawFinalEvents.forEach((event) => {
        const { sender, amount } = event.returnValues;
        console.log(`  Sender: ${sender} | Amount: ${fmt(amount)} ${symbol} (block ${event.blockNumber.toString()})`);
    });

    // ---- Express Lane Controllers Per Round (from resolved events) ----
    console.log("\n==================== EXPRESS LANE CONTROLLERS ====================");
    const currentRound = await auction.methods.currentRound().call();
    console.log("Current round:", currentRound.toString());

    // Use resolved events instead of querying every round individually
    resolvedEvents.forEach((event) => {
        const { round, expressLaneController } = event.returnValues;
        console.log(`  Round ${round.toString()}: ${expressLaneController}`);
    });

    // Also check the current round's controller
    const currentController = await auction.methods.expressLaneControllerByRound(currentRound).call();
    if (currentController !== "0x0000000000000000000000000000000000000000") {
        console.log(`  Round ${currentRound.toString()} (current): ${currentController}`);
    }
}

getTimeboostFullState().catch((err) => {
    console.error("Error fetching Timeboost state:", err.message);
    process.exit(1);
});
