const { Web3 } = require("web3");

// ==================== CONFIGURATION ====================
const RPC_URL = "https://arb1.arbitrum.io/rpc";
const PRIVATE_KEY = "YOUR_PRIVATE_KEY_HERE";

// ==================== BYTECODE ====================
// Replace with your compiled contract bytecode (hex string starting with 0x)
// Example: Simple storage contract
// NOTE: This example bytecode is a minimal storage contract (get/set uint256).
// Replace with your compiled contract bytecode.
const BYTECODE = "0x6080604052348015600e575f80fd5b5060a580601a5f395ff3fe6080604052348015600e575f80fd5b50600436106030575f3560e01c806360fe47b11460345780636d4ce63c146045575b5f80fd5b6043603f3660046058565b5f55565b005b5f5460405190815260200160405180910390f35b5f60208284031215606757600080fd5b503591905056fea164736f6c634300081c000a";

// ==================== CONSTRUCTOR ARGS ====================
// ABI types and values for constructor arguments (leave empty if none)
const CONSTRUCTOR_TYPES = [];       // e.g. ["uint256", "address"]
const CONSTRUCTOR_VALUES = [];      // e.g. [42, "0xAddress"]

// ==================== TX OVERRIDES ====================
const GAS_LIMIT = null;             // null = auto estimate
const VALUE_TO_SEND = Web3.utils.toWei("0", "ether");

// ==================== MAIN ====================
async function deployBytecode() {
    const web3 = new Web3(RPC_URL);
    const account = web3.eth.accounts.privateKeyToAccount(PRIVATE_KEY);
    web3.eth.accounts.wallet.add(account);

    const chainId = Number(await web3.eth.getChainId());

    console.log("==================== DEPLOYER ====================");
    console.log("Address:", account.address);
    console.log("Chain ID:", chainId);

    const balance = await web3.eth.getBalance(account.address);
    console.log("Balance:", Web3.utils.fromWei(balance, "ether"), "ETH");

    const nonce = Number(await web3.eth.getTransactionCount(account.address));
    console.log("Nonce:", nonce);

    // Predict contract address using RLP encoding: keccak256(rlp([sender, nonce]))[12:]
    function predictCreateAddress(sender, deployNonce) {
        const senderHex = sender.toLowerCase().replace("0x", "");
        const addressRlp = "94" + senderHex; // 0x80 + 20 = 0x94 (20-byte string)
        let nonceRlp;
        if (deployNonce === 0) {
            nonceRlp = "80"; // RLP for integer 0
        } else if (deployNonce < 128) {
            nonceRlp = deployNonce.toString(16).padStart(2, "0");
        } else {
            let nonceHex = deployNonce.toString(16);
            if (nonceHex.length % 2) nonceHex = "0" + nonceHex;
            nonceRlp = (128 + nonceHex.length / 2).toString(16).padStart(2, "0") + nonceHex;
        }
        const content = addressRlp + nonceRlp;
        const contentLen = content.length / 2;
        const prefix = (192 + contentLen).toString(16).padStart(2, "0"); // 0xc0 + len (list < 56 bytes)
        const rlp = "0x" + prefix + content;
        const hash = web3.utils.keccak256(rlp);
        return web3.utils.toChecksumAddress("0x" + hash.slice(26));
    }
    const predictedAddress = predictCreateAddress(account.address, nonce);
    console.log("Predicted contract address:", predictedAddress);

    // Encode constructor args
    let deployData = BYTECODE;
    if (CONSTRUCTOR_TYPES.length > 0) {
        const encodedArgs = web3.eth.abi.encodeParameters(CONSTRUCTOR_TYPES, CONSTRUCTOR_VALUES);
        deployData = BYTECODE + encodedArgs.slice(2);

        console.log("\n==================== CONSTRUCTOR ====================");
        CONSTRUCTOR_TYPES.forEach((type, i) => {
            console.log(`  ${type}: ${CONSTRUCTOR_VALUES[i]}`);
        });
        console.log("Encoded args:", encodedArgs);
    }

    console.log("\n==================== BYTECODE ====================");
    console.log("Bytecode length:", (BYTECODE.length - 2) / 2, "bytes");
    console.log("Deploy data length:", (deployData.length - 2) / 2, "bytes");

    // Estimate gas
    console.log("\n==================== GAS ESTIMATION ====================");
    const gasPrice = await web3.eth.getGasPrice();
    console.log("Gas price:", Web3.utils.fromWei(gasPrice, "gwei"), "gwei");

    let estimatedGas;
    try {
        estimatedGas = await web3.eth.estimateGas({
            from: account.address,
            data: deployData,
            value: VALUE_TO_SEND,
        });
        console.log("Estimated gas:", estimatedGas.toString());

        const estimatedCost = BigInt(estimatedGas) * BigInt(gasPrice);
        console.log("Estimated cost:", Web3.utils.fromWei(estimatedCost.toString(), "ether"), "ETH");

        if (estimatedCost > BigInt(balance)) {
            console.log("\nInsufficient balance for deployment!");
            process.exit(1);
        }
    } catch (err) {
        console.log("Gas estimation failed:", err.message);
        if (!GAS_LIMIT) {
            console.log("Set GAS_LIMIT manually to proceed.");
            process.exit(1);
        }
    }

    // Build deploy transaction
    const txObject = {
        from: account.address,
        data: deployData,
        value: VALUE_TO_SEND,
        nonce: nonce,
    };
    if (GAS_LIMIT) {
        txObject.gas = GAS_LIMIT;
    } else if (estimatedGas) {
        txObject.gas = Math.ceil(Number(estimatedGas) * 1.2).toString(); // 20% buffer
    }

    // Deploy
    console.log("\n==================== DEPLOYING ====================");
    const signedTx = await account.signTransaction(txObject);
    console.log("Tx hash:", signedTx.transactionHash);
    console.log("Sending...");

    const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

    console.log("\n==================== RECEIPT ====================");
    console.log("Status:", receipt.status ? "SUCCESS" : "REVERTED");
    console.log("Contract address:", receipt.contractAddress);
    console.log("Block:", receipt.blockNumber.toString());
    console.log("Gas used:", receipt.gasUsed.toString());
    console.log("Effective gas price:", Web3.utils.fromWei(receipt.effectiveGasPrice.toString(), "gwei"), "gwei");
    const deployCost = BigInt(receipt.gasUsed) * BigInt(receipt.effectiveGasPrice);
    console.log("Deploy cost:", Web3.utils.fromWei(deployCost.toString(), "ether"), "ETH");

    if (!receipt.status) {
        console.log("\nDeployment REVERTED!");
        process.exit(1);
    }

    // Verify deployed code
    console.log("\n==================== VERIFICATION ====================");
    const deployedCode = await web3.eth.getCode(receipt.contractAddress);
    console.log("Deployed code size:", (deployedCode.length - 2) / 2, "bytes");
    console.log("Code exists:", deployedCode !== "0x");
    console.log("Matches predicted address:", receipt.contractAddress.toLowerCase() === predictedAddress.toLowerCase());

    console.log("\n==================== DEPLOYMENT COMPLETE ====================");
    console.log("Contract:", receipt.contractAddress);
    console.log("Deployer:", account.address);
    console.log("Chain:", chainId);
    console.log("Block:", receipt.blockNumber.toString());
    console.log("Tx:", receipt.transactionHash);
}

deployBytecode().catch((err) => {
    console.error("Error deploying:", err.message);
    process.exit(1);
});
