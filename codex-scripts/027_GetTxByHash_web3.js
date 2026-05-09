const { Web3 } = require("web3");

const RPC_URL = "https://arb1.arbitrum.io/rpc";
const TX_HASH = process.env.TX_HASH || "0xa769dd1b0394f928dbcc11f51fc8913b48fbf8b2cfe95baa3e013ea213bb8526";

async function getTxByHash() {
    const web3 = new Web3(RPC_URL);

    // Fetch transaction
    const tx = await web3.eth.getTransaction(TX_HASH);
    if (!tx) {
        console.log("Transaction not found:", TX_HASH);
        process.exit(1);
    }

    console.log("TRANSACTION");
    console.log("Hash:", tx.hash);
    console.log("Status:", tx.blockNumber ? "MINED" : "PENDING");
    console.log("Block:", tx.blockNumber ? tx.blockNumber.toString() : "pending");
    console.log("Index:", tx.transactionIndex ? tx.transactionIndex.toString() : "N/A");

    console.log("\nADDRESSES");
    console.log("From:", tx.from);
    console.log("To:", tx.to || "(contract creation)");

    console.log("\nVALUE");
    console.log("Value:", Web3.utils.fromWei(tx.value.toString(), "ether"), "ETH");
    console.log("Value (wei):", tx.value.toString());

    console.log("\nGAS");
    console.log("Gas limit:", tx.gas.toString());
    console.log("Type:", tx.type.toString());
    if (tx.gasPrice) {
        console.log("Gas price:", Web3.utils.fromWei(tx.gasPrice.toString(), "gwei"), "gwei");
    }
    if (tx.maxFeePerGas) {
        console.log("Max fee per gas:", Web3.utils.fromWei(tx.maxFeePerGas.toString(), "gwei"), "gwei");
    }
    if (tx.maxPriorityFeePerGas) {
        console.log("Max priority fee:", Web3.utils.fromWei(tx.maxPriorityFeePerGas.toString(), "gwei"), "gwei");
    }

    console.log("\nSIGNATURE");
    console.log("Nonce:", tx.nonce.toString());
    console.log("Chain ID:", tx.chainId ? tx.chainId.toString() : "N/A");
    if (tx.v) console.log("v:", tx.v.toString());
    if (tx.r) console.log("r:", tx.r);
    if (tx.s) console.log("s:", tx.s);

    console.log("\nINPUT DATA");
    if (tx.input === "0x") {
        console.log("Data: (empty - native transfer)");
    } else {
        console.log("Data length:", (tx.input.length - 2) / 2, "bytes");
        console.log("Selector:", tx.input.slice(0, 10));
        console.log("Raw data:", tx.input.length > 200 ? tx.input.slice(0, 200) + "..." : tx.input);
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

    // Fetch receipt
    const receipt = await web3.eth.getTransactionReceipt(TX_HASH);
    if (!receipt) {
        console.log("\nRECEIPT");
        console.log("Receipt not available (tx may be pending)");
        return;
    }

    console.log("\nRECEIPT");
    console.log("Status:", receipt.status ? "SUCCESS" : "REVERTED");
    console.log("Block:", receipt.blockNumber.toString());
    console.log("Block hash:", receipt.blockHash);
    console.log("Gas used:", receipt.gasUsed.toString());
    console.log("Cumulative gas:", receipt.cumulativeGasUsed.toString());
    console.log("Effective gas price:", Web3.utils.fromWei(receipt.effectiveGasPrice.toString(), "gwei"), "gwei");
    const txCost = BigInt(receipt.gasUsed) * BigInt(receipt.effectiveGasPrice);
    console.log("Tx cost:", Web3.utils.fromWei(txCost.toString(), "ether"), "ETH");

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
        console.log("  Log index:", log.logIndex.toString());
    });

    // Block timestamp
    const block = await web3.eth.getBlock(Number(receipt.blockNumber));
    if (block) {
        console.log("\nTIMING");
        console.log("Block timestamp:", new Date(Number(block.timestamp) * 1000).toISOString());
    }
}

getTxByHash().catch((err) => {
    console.error("Error:", err.message);
    process.exit(1);
});
