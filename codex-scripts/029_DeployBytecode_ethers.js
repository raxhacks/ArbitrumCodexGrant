const { ethers } = require("ethers");

const RPC_URL = "https://arb1.arbitrum.io/rpc";
const PRIVATE_KEY = process.env.PRIVATE_KEY || ethers.Wallet.createRandom().privateKey;
const DRY_RUN = process.env.DRY_RUN !== "false";

// Replace with your compiled contract bytecode (hex string starting with 0x)
// Example: Simple storage contract
// NOTE: This example bytecode is a minimal storage contract (get/set uint256).
// Replace with your compiled contract bytecode.
const BYTECODE = "0x6080604052348015600e575f80fd5b5060a580601a5f395ff3fe6080604052348015600e575f80fd5b50600436106030575f3560e01c806360fe47b11460345780636d4ce63c146045575b5f80fd5b6043603f3660046058565b5f55565b005b5f5460405190815260200160405180910390f35b5f60208284031215606757600080fd5b503591905056fea164736f6c634300081c000a";

// ABI types and values for constructor arguments (leave empty if none)
const CONSTRUCTOR_TYPES = [];       // e.g. ["uint256", "address"]
const CONSTRUCTOR_VALUES = [];      // e.g. [42, "0xAddress"]

const GAS_LIMIT = null;             // null = auto estimate
const VALUE_TO_SEND = ethers.parseEther("0"); // ETH to send (for payable constructors)

async function deployBytecode() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const network = await provider.getNetwork();

    console.log("DEPLOYER");
    console.log("Address:", wallet.address);
    console.log("Chain ID:", network.chainId.toString());

    const balance = await provider.getBalance(wallet.address);
    console.log("Balance:", ethers.formatEther(balance), "ETH");

    const nonce = await provider.getTransactionCount(wallet.address);
    console.log("Nonce:", nonce);

    // Predict contract address
    const predictedAddress = ethers.getCreateAddress({ from: wallet.address, nonce: nonce });
    console.log("Predicted contract address:", predictedAddress);

    // Encode constructor args
    let deployData = BYTECODE;
    if (CONSTRUCTOR_TYPES.length > 0) {
        const abiCoder = ethers.AbiCoder.defaultAbiCoder();
        const encodedArgs = abiCoder.encode(CONSTRUCTOR_TYPES, CONSTRUCTOR_VALUES);
        deployData = BYTECODE + encodedArgs.slice(2);

        console.log("\nCONSTRUCTOR");
        CONSTRUCTOR_TYPES.forEach((type, i) => {
            console.log(`  ${type}: ${CONSTRUCTOR_VALUES[i]}`);
        });
        console.log("Encoded args:", encodedArgs);
    }

    console.log("\nBYTECODE");
    console.log("Bytecode length:", (BYTECODE.length - 2) / 2, "bytes");
    console.log("Deploy data length:", (deployData.length - 2) / 2, "bytes");

    // Estimate gas
    console.log("\nGAS ESTIMATION");
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice ?? feeData.maxFeePerGas ?? 0n;
    console.log("Gas price:", ethers.formatUnits(gasPrice, "gwei"), "gwei");

    let estimatedGas;
    try {
        estimatedGas = await provider.estimateGas({
            from: wallet.address,
            data: deployData,
            value: VALUE_TO_SEND,
        });
        console.log("Estimated gas:", estimatedGas.toString());

        const estimatedCost = estimatedGas * gasPrice;
        console.log("Estimated cost:", ethers.formatEther(estimatedCost), "ETH");

        if (estimatedCost > balance && !DRY_RUN) {
            console.log("\nInsufficient balance for deployment!");
            process.exit(1);
        }
    } catch (err) {
        console.log("Gas estimation failed:", err.message);
        if (!GAS_LIMIT && !DRY_RUN) {
            console.log("Set GAS_LIMIT manually to proceed.");
            process.exit(1);
        }
    }

    if (DRY_RUN) return;

    // Build deploy transaction
    const txRequest = {
        data: deployData,
        value: VALUE_TO_SEND,
    };
    if (GAS_LIMIT) txRequest.gasLimit = GAS_LIMIT;

    // Deploy
    console.log("\nDEPLOYING");
    const tx = await wallet.sendTransaction(txRequest);

    console.log("Tx hash:", tx.hash);
    console.log("Nonce:", tx.nonce);
    console.log("Gas limit:", tx.gasLimit.toString());
    console.log("Waiting for confirmation...");

    const receipt = await tx.wait();

    console.log("\nRECEIPT");
    console.log("Status:", receipt.status === 1 ? "SUCCESS" : "REVERTED");
    console.log("Contract address:", receipt.contractAddress);
    console.log("Block:", receipt.blockNumber);
    console.log("Gas used:", receipt.gasUsed.toString());
    console.log("Effective gas price:", ethers.formatUnits(receipt.gasPrice, "gwei"), "gwei");
    console.log("Deploy cost:", ethers.formatEther(receipt.gasUsed * receipt.gasPrice), "ETH");

    if (receipt.status !== 1) {
        console.log("\nDeployment REVERTED!");
        process.exit(1);
    }

    // Verify deployed code
    console.log("\nVERIFICATION");
    const deployedCode = await provider.getCode(receipt.contractAddress);
    console.log("Deployed code size:", (deployedCode.length - 2) / 2, "bytes");
    console.log("Code exists:", deployedCode !== "0x");
    console.log("Matches predicted address:", receipt.contractAddress.toLowerCase() === predictedAddress.toLowerCase());

    console.log("\nDEPLOYMENT COMPLETE");
    console.log("Contract:", receipt.contractAddress);
    console.log("Deployer:", wallet.address);
    console.log("Chain:", network.chainId.toString());
    console.log("Block:", receipt.blockNumber);
    console.log("Tx:", receipt.hash);
}

deployBytecode().catch((err) => {
    console.error("Error deploying:", err.message);
    process.exit(1);
});
