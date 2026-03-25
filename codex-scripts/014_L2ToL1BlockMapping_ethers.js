const { ethers } = require("ethers");

// ==================== CONFIGURATION ====================
const L1_RPC_URL = "https://eth.llamarpc.com";
const L2_RPC_URL = "https://arb1.arbitrum.io/rpc";
const L2_BLOCK_NUMBER = "latest"; // L2 block number or "latest"

// ==================== CONTRACT ADDRESSES ====================
const ARB_SYS_ADDRESS = "0x0000000000000000000000000000000000000064";
const NODE_INTERFACE_ADDRESS = "0x00000000000000000000000000000000000000C8";

// ==================== ABI ====================
const ARB_SYS_ABI = [
    "function arbBlockNumber() external view returns (uint256)",
    "function arbBlockHash(uint256 arbBlockNum) external view returns (bytes32)",
    "function getStorageGasAvailable() external view returns (uint256)",
];

const NODE_INTERFACE_ABI = [
    "function blockL1Num(uint64 l2BlockNum) external view returns (uint64)",
    "function l2BlockRangeForL1(uint64 l1BlockNum) external view returns (uint64 firstBlock, uint64 lastBlock)",
];

// ==================== MAIN ====================
async function getL2ToL1BlockMapping() {
    const l1Provider = new ethers.JsonRpcProvider(L1_RPC_URL);
    const l2Provider = new ethers.JsonRpcProvider(L2_RPC_URL);
    const arbSys = new ethers.Contract(ARB_SYS_ADDRESS, ARB_SYS_ABI, l2Provider);
    const nodeInterface = new ethers.Contract(NODE_INTERFACE_ADDRESS, NODE_INTERFACE_ABI, l2Provider);

    // Resolve L2 block number
    let l2BlockNum;
    if (L2_BLOCK_NUMBER === "latest") {
        l2BlockNum = await arbSys.arbBlockNumber();
        console.log("Using latest L2 block");
    } else {
        l2BlockNum = BigInt(L2_BLOCK_NUMBER);
    }

    console.log("==================== L2 BLOCK ====================");
    console.log("L2 block number:", l2BlockNum.toString());

    // Get L2 block details
    const l2Block = await l2Provider.getBlock(Number(l2BlockNum));
    if (!l2Block) {
        console.log("L2 block not found.");
        return;
    }

    console.log("L2 block hash:", l2Block.hash);
    console.log("L2 block timestamp:", new Date(l2Block.timestamp * 1000).toISOString());
    console.log("L2 transactions:", l2Block.transactions.length);

    // Get corresponding L1 block number
    console.log("\n==================== L1 BLOCK MAPPING ====================");
    const l1BlockNum = await nodeInterface.blockL1Num(l2BlockNum);
    console.log("Corresponding L1 block:", l1BlockNum.toString());

    // Get L1 block details
    const l1Block = await l1Provider.getBlock(Number(l1BlockNum));
    if (l1Block) {
        console.log("L1 block hash:", l1Block.hash);
        console.log("L1 block timestamp:", new Date(l1Block.timestamp * 1000).toISOString());
        console.log("L1 transactions:", l1Block.transactions.length);

        // Time difference
        const timeDiff = l2Block.timestamp - l1Block.timestamp;
        console.log("\nTime difference (L2 - L1):", timeDiff, "seconds");
    }

    // Get L2 block range for the L1 block
    console.log("\n==================== L2 RANGE FOR L1 BLOCK ====================");
    const l2Range = await nodeInterface.l2BlockRangeForL1(l1BlockNum);
    console.log("L1 block:", l1BlockNum.toString());
    console.log("First L2 block:", l2Range.firstBlock.toString());
    console.log("Last L2 block:", l2Range.lastBlock.toString());
    console.log("Total L2 blocks in range:", (Number(l2Range.lastBlock) - Number(l2Range.firstBlock) + 1).toString());

    // Map surrounding L2 blocks to L1
    console.log("\n==================== SURROUNDING BLOCKS ====================");
    const rangeStart = Number(l2BlockNum) - 5;
    const rangeEnd = Number(l2BlockNum) + 5;
    const start = rangeStart > 0 ? rangeStart : 0;

    const blockNums = [];
    for (let i = start; i <= rangeEnd; i++) blockNums.push(i);

    const mappingResults = await Promise.allSettled(
        blockNums.map((i) => nodeInterface.blockL1Num(i).then((l1) => ({ i, l1 })))
    );

    for (const result of mappingResults) {
        if (result.status === "fulfilled") {
            const { i, l1 } = result.value;
            const marker = i === Number(l2BlockNum) ? " <-- target" : "";
            console.log(`  L2 #${i} -> L1 #${l1.toString()}${marker}`);
        }
    }
}

getL2ToL1BlockMapping().catch((err) => {
    console.error("Error mapping blocks:", err.message);
    process.exit(1);
});
