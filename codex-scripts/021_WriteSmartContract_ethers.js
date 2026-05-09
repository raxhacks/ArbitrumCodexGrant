const { ethers } = require("ethers");

const RPC_URL = "https://arb1.arbitrum.io/rpc";
const PRIVATE_KEY = process.env.PRIVATE_KEY || ethers.Wallet.createRandom().privateKey;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "0x912CE59144191C1204E64559FE8253a0e49E6548";
const DRY_RUN = process.env.DRY_RUN !== "false";

// Replace with your contract's ABI (functions you want to call)
const CONTRACT_ABI = [
    // Example state-changing functions
    "function set(uint256 value) external",
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function transfer(address to, uint256 amount) external returns (bool)",
    "function mint(address to, uint256 amount) external",
    "function setOwner(address newOwner) external",
    // Example view functions (for reading before/after)
    "function get() external view returns (uint256)",
    "function balanceOf(address account) external view returns (uint256)",
    "function owner() external view returns (address)",
];

const FUNCTION_NAME = "transfer";
let FUNCTION_ARGS = null;
const VALUE_TO_SEND = ethers.parseEther("0");  // ETH to send with tx (0 for non-payable)
const GAS_LIMIT = null;                        // null = auto estimate
const MAX_FEE_PER_GAS = null;                  // null = auto
const MAX_PRIORITY_FEE = null;                 // null = auto

async function writeToContract() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

    if (FUNCTION_ARGS === null) FUNCTION_ARGS = [wallet.address, 0n];

    const network = await provider.getNetwork();

    console.log("ACCOUNT");
    console.log("Wallet:", wallet.address);
    console.log("Chain ID:", network.chainId.toString());

    const ethBalance = await provider.getBalance(wallet.address);
    console.log("ETH balance:", ethers.formatEther(ethBalance), "ETH");

    // Verify contract exists
    const code = await provider.getCode(CONTRACT_ADDRESS);
    if (code === "0x") {
        console.log("No contract at:", CONTRACT_ADDRESS);
        process.exit(1);
    }
    console.log("Contract:", CONTRACT_ADDRESS);

    // Encode function call
    console.log("\nFUNCTION CALL");
    console.log("Function:", FUNCTION_NAME);
    console.log("Arguments:", FUNCTION_ARGS);
    console.log("Value:", ethers.formatEther(VALUE_TO_SEND), "ETH");

    const iface = new ethers.Interface(CONTRACT_ABI);
    const encodedData = iface.encodeFunctionData(FUNCTION_NAME, FUNCTION_ARGS);
    console.log("Encoded data:", encodedData);

    // Estimate gas
    console.log("\nGAS ESTIMATION");
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice ?? feeData.maxFeePerGas ?? 0n;
    console.log("Base fee:", ethers.formatUnits(gasPrice, "gwei"), "gwei");
    console.log("Max fee per gas:", feeData.maxFeePerGas ? ethers.formatUnits(feeData.maxFeePerGas, "gwei") + " gwei" : "N/A");
    console.log("Max priority fee:", feeData.maxPriorityFeePerGas ? ethers.formatUnits(feeData.maxPriorityFeePerGas, "gwei") + " gwei" : "N/A");

    let estimatedGas;
    try {
        estimatedGas = await contract[FUNCTION_NAME].estimateGas(...FUNCTION_ARGS, { value: VALUE_TO_SEND });
        console.log("Estimated gas:", estimatedGas.toString());

        const estimatedCost = estimatedGas * gasPrice;
        console.log("Estimated cost:", ethers.formatEther(estimatedCost), "ETH");
    } catch (err) {
        console.log("Gas estimation failed:", err.message);
        console.log("Transaction may revert. Proceeding with manual gas limit if set.");
        if (!GAS_LIMIT) {
            process.exit(1);
        }
    }

    // Build tx overrides
    const overrides = { value: VALUE_TO_SEND };
    if (GAS_LIMIT) overrides.gasLimit = GAS_LIMIT;
    if (MAX_FEE_PER_GAS) overrides.maxFeePerGas = MAX_FEE_PER_GAS;
    if (MAX_PRIORITY_FEE) overrides.maxPriorityFeePerGas = MAX_PRIORITY_FEE;

    // Get nonce
    const nonce = await provider.getTransactionCount(wallet.address);
    console.log("Nonce:", nonce);

    // Simulate call (static call to check for revert)
    console.log("\nSIMULATION");
    try {
        const result = await contract[FUNCTION_NAME].staticCall(...FUNCTION_ARGS, { value: VALUE_TO_SEND });
        console.log("Simulation result:", result !== undefined ? result.toString() : "void");
        console.log("Simulation: PASSED");
    } catch (err) {
        console.log("Simulation: REVERTED");
        console.log("Reason:", err.reason || err.message);
        console.log("Aborting transaction.");
        process.exit(1);
    }

    if (DRY_RUN) return;

    // Send transaction
    console.log("\nSENDING TRANSACTION");
    const tx = await contract[FUNCTION_NAME](...FUNCTION_ARGS, overrides);

    console.log("Tx hash:", tx.hash);
    console.log("Nonce:", tx.nonce);
    console.log("Gas limit:", tx.gasLimit.toString());
    console.log("Waiting for confirmation...");

    const receipt = await tx.wait();

    console.log("\nRECEIPT");
    console.log("Status:", receipt.status === 1 ? "SUCCESS" : "REVERTED");
    console.log("Block:", receipt.blockNumber);
    console.log("Gas used:", receipt.gasUsed.toString());
    console.log("Effective gas price:", ethers.formatUnits(receipt.gasPrice, "gwei"), "gwei");
    console.log("Actual cost:", ethers.formatEther(receipt.gasUsed * receipt.gasPrice), "ETH");

    // Decode logs
    if (receipt.logs.length > 0) {
        console.log("\nEVENTS");
        console.log("Total events:", receipt.logs.length);
        receipt.logs.forEach((log, index) => {
            try {
                const parsed = iface.parseLog({ topics: log.topics, data: log.data });
                console.log(`\n--- Event ${index + 1}: ${parsed.name} ---`);
                parsed.fragment.inputs.forEach((input, i) => {
                    console.log(`  ${input.name}: ${parsed.args[i].toString()}`);
                });
            } catch {
                console.log(`\n--- Event ${index + 1}: UNKNOWN ---`);
                console.log("  Address:", log.address);
                console.log("  Topics:", log.topics);
            }
        });
    }
}

writeToContract().catch((err) => {
    console.error("Error writing to contract:", err.message);
    process.exit(1);
});
