const { ethers } = require("ethers");

const RPC_URL = "https://arb1.arbitrum.io/rpc";
const EXPRESS_LANE_AUCTION_ADDRESS = "0x5fcb496a31b7AE91e7c9078Ec662bd7A55cd3079";
const TX_HASH = process.env.TX_HASH || "0xb19e7f3ae8a72fadc2f95e8d28957a861496590a86c8e5b0a2d939885b6bbdea";

const EXPRESS_LANE_AUCTION_ABI = [
    "function placeBid(uint64 round, address expressLaneController, uint256 amount, bytes signature) external",
    "function deposit(uint256 amount) external",
    "function initiateWithdrawal() external",
    "function finalizeWithdrawal() external",
    "function resolveAuction(uint64 round, address firstPriceBidder, address firstPriceExpressLaneController, uint256 firstPriceAmount, bytes firstPriceSignature, address secondPriceBidder, address secondPriceExpressLaneController, uint256 secondPriceAmount, bytes secondPriceSignature) external",
    "function resolveSingleBidAuction(uint64 round, address bidder, address expressLaneController, uint256 amount, bytes signature) external",
    "function setReservePrice(uint256 newReservePrice) external",
    "function setMinReservePrice(uint256 newMinReservePrice) external",
    "function setBeneficiary(address newBeneficiary) external",
    "function setRoundTimingInfo(uint64 currentRound, int64 offsetTimestamp, uint64 roundDurationSeconds, uint64 auctionClosingSeconds) external",
    "function transferExpressLaneController(uint64 round, address newExpressLaneController) external",
    "event AuctionResolved(uint64 indexed round, address indexed firstPriceBidder, address indexed expressLaneController, uint256 price)",
    "event SetReservePrice(uint256 oldReservePrice, uint256 newReservePrice)",
    "event SetMinReservePrice(uint256 oldPrice, uint256 newPrice)",
    "event SetBeneficiary(address oldBeneficiary, address newBeneficiary)",
    "event Deposit(address indexed sender, uint256 amount)",
    "event WithdrawalInitiated(address indexed sender, uint256 amount)",
    "event WithdrawalFinalized(address indexed sender, uint256 amount)",
    "event ExpressLaneControllerTransferred(uint64 indexed round, address indexed from, address indexed to)",
    "event SetRoundTimingInfo(uint64 currentRound, int64 offsetTimestamp, uint64 roundDurationSeconds, uint64 auctionClosingSeconds)",
];

async function decodeTimeboostTx() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const iface = new ethers.Interface(EXPRESS_LANE_AUCTION_ABI);

    // Fetch the transaction
    const tx = await provider.getTransaction(TX_HASH);
    if (!tx) {
        console.log("Transaction not found:", TX_HASH);
        process.exit(1);
    }

    console.log("TRANSACTION INFO");
    console.log("Hash:", tx.hash);
    console.log("From:", tx.from);
    console.log("To:", tx.to);
    console.log("Value:", ethers.formatEther(tx.value), "ETH");
    console.log("Block:", tx.blockNumber);
    console.log("Gas limit:", tx.gasLimit.toString());

    // Decode function call
    console.log("\nDECODED FUNCTION CALL");
    try {
        const decoded = iface.parseTransaction({ data: tx.data, value: tx.value });
        console.log("Function:", decoded.name);
        console.log("Signature:", decoded.signature);
        console.log("\nParameters:");
        decoded.fragment.inputs.forEach((input, i) => {
            const value = decoded.args[i];
            let displayValue = value.toString();

            if (input.type === "uint256") {
                displayValue = `${value.toString()} (${ethers.formatEther(value)} if 18 decimals)`;
            } else if (input.type === "bytes") {
                displayValue = value.length > 66
                    ? `${value.substring(0, 66)}... (${(value.length - 2) / 2} bytes)`
                    : value;
            }

            console.log(`  ${input.name} (${input.type}): ${displayValue}`);
        });
    } catch (err) {
        console.log("Could not decode function call:", err.message);
        console.log("Raw data:", tx.data);
    }

    // Fetch receipt and decode logs
    const receipt = await provider.getTransactionReceipt(TX_HASH);
    if (!receipt) {
        console.log("\nTransaction receipt not found (pending?)");
        return;
    }

    console.log("\nTRANSACTION RESULT");
    console.log("Status:", receipt.status === 1 ? "SUCCESS" : "REVERTED");
    console.log("Gas used:", receipt.gasUsed.toString());
    console.log("Effective gas price:", ethers.formatUnits(receipt.gasPrice, "gwei"), "gwei");

    console.log("\nDECODED EVENTS");
    console.log("Total logs:", receipt.logs.length);

    receipt.logs.forEach((log, index) => {
        try {
            const parsed = iface.parseLog({ topics: log.topics, data: log.data });
            console.log(`\n--- Event ${index + 1}: ${parsed.name} ---`);
            parsed.fragment.inputs.forEach((input, i) => {
                const value = parsed.args[i];
                let displayValue = value.toString();

                if (input.type === "uint256") {
                    displayValue = `${value.toString()} (${ethers.formatEther(value)} if 18 decimals)`;
                }

                console.log(`  ${input.name} (${input.type}): ${displayValue}`);
            });
        } catch {
            console.log(`\n--- Event ${index + 1}: UNKNOWN ---`);
            console.log("  Address:", log.address);
            console.log("  Topics:", log.topics);
            console.log("  Data:", log.data);
        }
    });
}

decodeTimeboostTx().catch((err) => {
    console.error("Error decoding transaction:", err.message);
    process.exit(1);
});
