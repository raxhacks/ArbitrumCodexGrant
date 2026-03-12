const { Web3 } = require("web3");

// ==================== CONFIGURATION ====================
const RPC_URL = "https://arb1.arbitrum.io/rpc";
const BLOCK_NUMBER = "latest"; // "latest", "pending", "earliest", or a number

// ==================== MAIN ====================
async function getBlockInfo() {
    const web3 = new Web3(RPC_URL);

    const block = await web3.eth.getBlock(BLOCK_NUMBER, true);
    if (!block) {
        console.log("Block not found:", BLOCK_NUMBER);
        process.exit(1);
    }

    console.log("==================== BLOCK INFO ====================");
    console.log("Number:", block.number.toString());
    console.log("Hash:", block.hash);
    console.log("Parent hash:", block.parentHash);
    console.log("Timestamp:", block.timestamp.toString(), `(${new Date(Number(block.timestamp) * 1000).toISOString()})`);
    console.log("Nonce:", block.nonce);
    console.log("Difficulty:", block.difficulty.toString());

    console.log("\n==================== MINER / VALIDATOR ====================");
    console.log("Miner:", block.miner);
    console.log("Extra data:", block.extraData);

    console.log("\n==================== GAS ====================");
    console.log("Gas limit:", block.gasLimit.toString());
    console.log("Gas used:", block.gasUsed.toString());
    const gasUsedPercent = (Number(block.gasUsed) / Number(block.gasLimit) * 100).toFixed(2);
    console.log("Gas utilization:", gasUsedPercent + "%");
    if (block.baseFeePerGas !== null && block.baseFeePerGas !== undefined) {
        console.log("Base fee per gas:", Web3.utils.fromWei(block.baseFeePerGas.toString(), "gwei"), "gwei");
    }

    console.log("\n==================== TRANSACTIONS ====================");
    console.log("Transaction count:", block.transactions.length);

    if (block.transactions.length > 0 && typeof block.transactions[0] === "object") {
        let totalValue = 0n;

        block.transactions.forEach((tx) => {
            totalValue += BigInt(tx.value);
        });

        console.log("Total value transferred:", Web3.utils.fromWei(totalValue.toString(), "ether"), "ETH");

        // Show first 10 transactions
        const displayCount = Math.min(block.transactions.length, 10);
        console.log(`\nFirst ${displayCount} transactions:`);
        block.transactions.slice(0, displayCount).forEach((tx, i) => {
            console.log(`\n  --- Tx ${i + 1} ---`);
            console.log("  Hash:", tx.hash);
            console.log("  From:", tx.from);
            console.log("  To:", tx.to || "(contract creation)");
            console.log("  Value:", Web3.utils.fromWei(tx.value.toString(), "ether"), "ETH");
            console.log("  Gas:", tx.gas.toString());
            if (tx.maxFeePerGas) {
                console.log("  Max fee:", Web3.utils.fromWei(tx.maxFeePerGas.toString(), "gwei"), "gwei");
            }
            if (tx.maxPriorityFeePerGas) {
                console.log("  Priority fee:", Web3.utils.fromWei(tx.maxPriorityFeePerGas.toString(), "gwei"), "gwei");
            }
            console.log("  Type:", tx.type.toString());
            console.log("  Nonce:", tx.nonce.toString());
        });

        if (block.transactions.length > displayCount) {
            console.log(`\n  ... and ${block.transactions.length - displayCount} more`);
        }
    } else if (block.transactions.length > 0) {
        // Only tx hashes
        const displayCount = Math.min(block.transactions.length, 10);
        console.log(`\nFirst ${displayCount} tx hashes:`);
        block.transactions.slice(0, displayCount).forEach((hash, i) => {
            console.log(`  ${i + 1}. ${hash}`);
        });
        if (block.transactions.length > displayCount) {
            console.log(`  ... and ${block.transactions.length - displayCount} more`);
        }
    }

    console.log("\n==================== ROOTS ====================");
    console.log("State root:", block.stateRoot);
    console.log("Receipts root:", block.receiptsRoot);
    console.log("Transactions root:", block.transactionsRoot);

    // Blob gas (EIP-4844)
    if (block.blobGasUsed !== null && block.blobGasUsed !== undefined) {
        console.log("\n==================== BLOB GAS (EIP-4844) ====================");
        console.log("Blob gas used:", block.blobGasUsed.toString());
    }
}

getBlockInfo().catch((err) => {
    console.error("Error:", err.message);
    process.exit(1);
});
