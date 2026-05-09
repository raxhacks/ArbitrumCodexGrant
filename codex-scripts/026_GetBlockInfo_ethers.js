const { ethers } = require("ethers");

const RPC_URL = "https://arb1.arbitrum.io/rpc";
const BLOCK_NUMBER = "latest"; // "latest", "pending", "earliest", or a number

async function getBlockInfo() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    const block = await provider.getBlock(BLOCK_NUMBER, true);
    if (!block) {
        console.log("Block not found:", BLOCK_NUMBER);
        process.exit(1);
    }

    console.log("BLOCK INFO");
    console.log("Number:", block.number);
    console.log("Hash:", block.hash);
    console.log("Parent hash:", block.parentHash);
    console.log("Timestamp:", block.timestamp, `(${new Date(block.timestamp * 1000).toISOString()})`);
    console.log("Nonce:", block.nonce);
    console.log("Difficulty:", block.difficulty.toString());

    console.log("\nMINER / VALIDATOR");
    console.log("Miner:", block.miner);
    console.log("Extra data:", block.extraData);

    console.log("\nGAS");
    console.log("Gas limit:", block.gasLimit.toString());
    console.log("Gas used:", block.gasUsed.toString());
    const gasUsedPercent = (Number(block.gasUsed) / Number(block.gasLimit) * 100).toFixed(2);
    console.log("Gas utilization:", gasUsedPercent + "%");
    if (block.baseFeePerGas !== null && block.baseFeePerGas !== undefined) {
        console.log("Base fee per gas:", ethers.formatUnits(block.baseFeePerGas, "gwei"), "gwei");
    }

    console.log("\nTRANSACTIONS");
    console.log("Transaction count:", block.transactions.length);

    if (block.prefetchedTransactions && block.prefetchedTransactions.length > 0) {
        let totalValue = 0n;

        block.prefetchedTransactions.forEach((tx) => {
            totalValue += tx.value;
        });

        console.log("Total value transferred:", ethers.formatEther(totalValue), "ETH");

        // Show first 10 transactions
        const displayCount = Math.min(block.prefetchedTransactions.length, 10);
        console.log(`\nFirst ${displayCount} transactions:`);
        block.prefetchedTransactions.slice(0, displayCount).forEach((tx, i) => {
            console.log(`\n  --- Tx ${i + 1} ---`);
            console.log("  Hash:", tx.hash);
            console.log("  From:", tx.from);
            console.log("  To:", tx.to || "(contract creation)");
            console.log("  Value:", ethers.formatEther(tx.value), "ETH");
            console.log("  Gas limit:", tx.gasLimit.toString());
            if (tx.maxFeePerGas) {
                console.log("  Max fee:", ethers.formatUnits(tx.maxFeePerGas, "gwei"), "gwei");
            }
            if (tx.maxPriorityFeePerGas) {
                console.log("  Priority fee:", ethers.formatUnits(tx.maxPriorityFeePerGas, "gwei"), "gwei");
            }
            console.log("  Type:", tx.type);
            console.log("  Nonce:", tx.nonce);
        });

        if (block.prefetchedTransactions.length > displayCount) {
            console.log(`\n  ... and ${block.prefetchedTransactions.length - displayCount} more`);
        }
    } else {
        // Only tx hashes available
        if (block.transactions.length > 0) {
            const displayCount = Math.min(block.transactions.length, 10);
            console.log(`\nFirst ${displayCount} tx hashes:`);
            block.transactions.slice(0, displayCount).forEach((hash, i) => {
                console.log(`  ${i + 1}. ${hash}`);
            });
            if (block.transactions.length > displayCount) {
                console.log(`  ... and ${block.transactions.length - displayCount} more`);
            }
        }
    }

    console.log("\nROOTS");
    console.log("State root:", block.stateRoot);
    console.log("Receipts root:", block.receiptsRoot);
    console.log("Transactions root:", block.transactionsRoot);

    // Blob gas (EIP-4844)
    if (block.blobGasUsed !== null && block.blobGasUsed !== undefined) {
        console.log("\nBLOB GAS (EIP-4844)");
        console.log("Blob gas used:", block.blobGasUsed.toString());
    }
}

getBlockInfo().catch((err) => {
    console.error("Error:", err.message);
    process.exit(1);
});
