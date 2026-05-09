const { ethers } = require("ethers");

const RPC_URL = "https://arb1.arbitrum.io/rpc";
const TX_HASH = process.env.TX_HASH || "0xa769dd1b0394f928dbcc11f51fc8913b48fbf8b2cfe95baa3e013ea213bb8526";

async function getTxByHash() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    // Fetch transaction
    const tx = await provider.getTransaction(TX_HASH);
    if (!tx) {
        console.log("Transaction not found:", TX_HASH);
        process.exit(1);
    }

    console.log("TRANSACTION");
    console.log("Hash:", tx.hash);
    console.log("Status:", tx.blockNumber ? "MINED" : "PENDING");
    console.log("Block:", tx.blockNumber || "pending");
    console.log("Index:", tx.index);

    console.log("\nADDRESSES");
    console.log("From:", tx.from);
    console.log("To:", tx.to || "(contract creation)");

    console.log("\nVALUE");
    console.log("Value:", ethers.formatEther(tx.value), "ETH");
    console.log("Value (wei):", tx.value.toString());

    console.log("\nGAS");
    console.log("Gas limit:", tx.gasLimit.toString());
    console.log("Type:", tx.type);
    if (tx.gasPrice) {
        console.log("Gas price:", ethers.formatUnits(tx.gasPrice, "gwei"), "gwei");
    }
    if (tx.maxFeePerGas) {
        console.log("Max fee per gas:", ethers.formatUnits(tx.maxFeePerGas, "gwei"), "gwei");
    }
    if (tx.maxPriorityFeePerGas) {
        console.log("Max priority fee:", ethers.formatUnits(tx.maxPriorityFeePerGas, "gwei"), "gwei");
    }

    console.log("\nSIGNATURE");
    console.log("Nonce:", tx.nonce);
    console.log("Chain ID:", tx.chainId.toString());
    if (tx.signature) {
        console.log("v:", tx.signature.v);
        console.log("r:", tx.signature.r);
        console.log("s:", tx.signature.s);
    }

    console.log("\nINPUT DATA");
    if (tx.data === "0x") {
        console.log("Data: (empty - native transfer)");
    } else {
        console.log("Data length:", (tx.data.length - 2) / 2, "bytes");
        console.log("Selector:", tx.data.slice(0, 10));
        console.log("Raw data:", tx.data.length > 200 ? tx.data.slice(0, 200) + "..." : tx.data);
    }

    // Access list (EIP-2930)
    if (tx.accessList && tx.accessList.length > 0) {
        console.log("\nACCESS LIST");
        console.log("Entries:", tx.accessList.length);
        tx.accessList.forEach((entry, i) => {
            console.log(`\n  [${i}] Address: ${entry.address}`);
            console.log(`      Storage keys: ${entry.storageKeys.length}`);
            entry.storageKeys.slice(0, 3).forEach((key) => {
                console.log(`        ${key}`);
            });
            if (entry.storageKeys.length > 3) {
                console.log(`        ... and ${entry.storageKeys.length - 3} more`);
            }
        });
    }

    // Blob versioned hashes (EIP-4844)
    if (tx.blobVersionedHashes && tx.blobVersionedHashes.length > 0) {
        console.log("\nBLOB DATA (EIP-4844)");
        console.log("Blob count:", tx.blobVersionedHashes.length);
        tx.blobVersionedHashes.forEach((hash, i) => {
            console.log(`  [${i}]: ${hash}`);
        });
    }

    // Fetch receipt
    const receipt = await provider.getTransactionReceipt(TX_HASH);
    if (!receipt) {
        console.log("\nRECEIPT");
        console.log("Receipt not available (tx may be pending)");
        return;
    }

    console.log("\nRECEIPT");
    console.log("Status:", receipt.status === 1 ? "SUCCESS" : "REVERTED");
    console.log("Block:", receipt.blockNumber);
    console.log("Block hash:", receipt.blockHash);
    console.log("Gas used:", receipt.gasUsed.toString());
    console.log("Cumulative gas:", receipt.cumulativeGasUsed.toString());
    console.log("Effective gas price:", ethers.formatUnits(receipt.gasPrice, "gwei"), "gwei");
    console.log("Tx cost:", ethers.formatEther(receipt.gasUsed * receipt.gasPrice), "ETH");

    if (receipt.contractAddress) {
        console.log("Contract created:", receipt.contractAddress);
    }

    console.log("Log bloom:", receipt.logsBloom.slice(0, 66) + "...");

    // Logs
    console.log("\nLOGS");
    console.log("Total logs:", receipt.logs.length);

    receipt.logs.forEach((log, i) => {
        console.log(`\n  --- Log ${i + 1} ---`);
        console.log("  Address:", log.address);
        console.log("  Topics:");
        log.topics.forEach((topic, j) => {
            console.log(`    [${j}]: ${topic}`);
        });
        if (log.data !== "0x") {
            console.log("  Data:", log.data.length > 130 ? log.data.slice(0, 130) + "..." : log.data);
        }
        console.log("  Log index:", log.index);
    });

    // Block timestamp
    const block = await provider.getBlock(receipt.blockNumber);
    if (block) {
        console.log("\nTIMING");
        console.log("Block timestamp:", new Date(block.timestamp * 1000).toISOString());
    }
}

getTxByHash().catch((err) => {
    console.error("Error:", err.message);
    process.exit(1);
});
