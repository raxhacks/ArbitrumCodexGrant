const { Web3 } = require("web3");

// ==================== CONFIGURATION ====================
const RPC_URL = "https://arb1.arbitrum.io/rpc";
const PRIVATE_KEY = "YOUR_PRIVATE_KEY_HERE";
const CONTRACT_ADDRESS = "YOUR_CONTRACT_ADDRESS_HERE";

// ==================== ABI ====================
// Replace with your contract's ABI (functions you want to call)
const CONTRACT_ABI = [
    // Example state-changing functions
    {
        name: "set",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [{ name: "value", type: "uint256" }],
        outputs: [],
    },
    {
        name: "approve",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "spender", type: "address" },
            { name: "amount", type: "uint256" },
        ],
        outputs: [{ name: "", type: "bool" }],
    },
    {
        name: "transfer",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "to", type: "address" },
            { name: "amount", type: "uint256" },
        ],
        outputs: [{ name: "", type: "bool" }],
    },
    {
        name: "mint",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "to", type: "address" },
            { name: "amount", type: "uint256" },
        ],
        outputs: [],
    },
    {
        name: "setOwner",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [{ name: "newOwner", type: "address" }],
        outputs: [],
    },
    // Example view functions
    {
        name: "get",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
    },
    {
        name: "balanceOf",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "account", type: "address" }],
        outputs: [{ name: "", type: "uint256" }],
    },
    {
        name: "owner",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "address" }],
    },
];

// ==================== TX CONFIGURATION ====================
const FUNCTION_NAME = "set";                         // Function to call
const FUNCTION_ARGS = [42];                          // Arguments to pass
const VALUE_TO_SEND = Web3.utils.toWei("0", "ether"); // ETH to send (0 for non-payable)
const GAS_LIMIT = null;                              // null = auto estimate
const MAX_FEE_PER_GAS = null;                        // null = auto
const MAX_PRIORITY_FEE = null;                        // null = auto

// ==================== MAIN ====================
async function writeToContract() {
    const web3 = new Web3(RPC_URL);
    const account = web3.eth.accounts.privateKeyToAccount(PRIVATE_KEY);
    web3.eth.accounts.wallet.add(account);
    const contract = new web3.eth.Contract(CONTRACT_ABI, CONTRACT_ADDRESS);

    const chainId = Number(await web3.eth.getChainId());

    console.log("==================== ACCOUNT ====================");
    console.log("Wallet:", account.address);
    console.log("Chain ID:", chainId);

    const ethBalance = await web3.eth.getBalance(account.address);
    console.log("ETH balance:", Web3.utils.fromWei(ethBalance, "ether"), "ETH");

    // Verify contract exists
    const code = await web3.eth.getCode(CONTRACT_ADDRESS);
    if (code === "0x") {
        console.log("No contract at:", CONTRACT_ADDRESS);
        process.exit(1);
    }
    console.log("Contract:", CONTRACT_ADDRESS);

    // Encode function call
    console.log("\n==================== FUNCTION CALL ====================");
    console.log("Function:", FUNCTION_NAME);
    console.log("Arguments:", FUNCTION_ARGS);
    console.log("Value:", Web3.utils.fromWei(VALUE_TO_SEND, "ether"), "ETH");

    const txMethod = contract.methods[FUNCTION_NAME](...FUNCTION_ARGS);
    const encodedData = txMethod.encodeABI();
    console.log("Encoded data:", encodedData);

    // Estimate gas
    console.log("\n==================== GAS ESTIMATION ====================");
    const gasPrice = await web3.eth.getGasPrice();
    console.log("Gas price:", Web3.utils.fromWei(gasPrice, "gwei"), "gwei");

    let estimatedGas;
    try {
        estimatedGas = await txMethod.estimateGas({
            from: account.address,
            value: VALUE_TO_SEND,
        });
        console.log("Estimated gas:", estimatedGas.toString());

        const estimatedCost = BigInt(estimatedGas) * BigInt(gasPrice);
        console.log("Estimated cost:", Web3.utils.fromWei(estimatedCost.toString(), "ether"), "ETH");
    } catch (err) {
        console.log("Gas estimation failed:", err.message);
        console.log("Transaction may revert. Proceeding with manual gas limit if set.");
        if (!GAS_LIMIT) {
            process.exit(1);
        }
    }

    // Get nonce
    const nonce = await web3.eth.getTransactionCount(account.address);
    console.log("Nonce:", nonce.toString());

    // Simulate call
    console.log("\n==================== SIMULATION ====================");
    try {
        const result = await txMethod.call({
            from: account.address,
            value: VALUE_TO_SEND,
        });
        console.log("Simulation result:", result !== undefined ? result.toString() : "void");
        console.log("Simulation: PASSED");
    } catch (err) {
        console.log("Simulation: REVERTED");
        console.log("Reason:", err.message);
        console.log("Aborting transaction.");
        process.exit(1);
    }

    // Build tx options
    const txOptions = {
        from: account.address,
        value: VALUE_TO_SEND,
    };
    if (GAS_LIMIT) txOptions.gas = GAS_LIMIT;
    if (MAX_FEE_PER_GAS) txOptions.maxFeePerGas = MAX_FEE_PER_GAS;
    if (MAX_PRIORITY_FEE) txOptions.maxPriorityFeePerGas = MAX_PRIORITY_FEE;

    // Send transaction
    console.log("\n==================== SENDING TRANSACTION ====================");
    const receipt = await txMethod.send(txOptions);

    console.log("Tx hash:", receipt.transactionHash);

    console.log("\n==================== RECEIPT ====================");
    console.log("Status:", receipt.status ? "SUCCESS" : "REVERTED");
    console.log("Block:", receipt.blockNumber.toString());
    console.log("Gas used:", receipt.gasUsed.toString());
    console.log("Effective gas price:", Web3.utils.fromWei(receipt.effectiveGasPrice.toString(), "gwei"), "gwei");
    console.log("Actual cost:", Web3.utils.fromWei((BigInt(receipt.gasUsed) * BigInt(receipt.effectiveGasPrice)).toString(), "ether"), "ETH");

    // Decode logs
    if (receipt.logs && receipt.logs.length > 0) {
        console.log("\n==================== EVENTS ====================");
        console.log("Total events:", receipt.logs.length);

        const eventAbis = CONTRACT_ABI.filter((item) => item.type === "event");

        receipt.logs.forEach((log, index) => {
            let decoded = false;
            for (const eventAbi of eventAbis) {
                const eventSig = web3.eth.abi.encodeEventSignature(eventAbi);
                if (log.topics && log.topics[0] === eventSig) {
                    const nonIndexed = eventAbi.inputs.filter((i) => !i.indexed);
                    const indexed = eventAbi.inputs.filter((i) => i.indexed);

                    console.log(`\n--- Event ${index + 1}: ${eventAbi.name} ---`);
                    indexed.forEach((input, i) => {
                        const val = input.type === "address"
                            ? "0x" + log.topics[i + 1].slice(26)
                            : web3.eth.abi.decodeParameter(input.type, log.topics[i + 1]);
                        console.log(`  ${input.name}: ${val}`);
                    });
                    if (nonIndexed.length > 0 && log.data !== "0x") {
                        const decodedData = web3.eth.abi.decodeParameters(nonIndexed, log.data);
                        nonIndexed.forEach((input) => {
                            console.log(`  ${input.name}: ${decodedData[input.name]}`);
                        });
                    }
                    decoded = true;
                    break;
                }
            }
            if (!decoded) {
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
