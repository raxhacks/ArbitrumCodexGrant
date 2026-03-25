const { ethers } = require("ethers");

// ==================== CONFIGURATION ====================
const RPC_URL = "https://arb1.arbitrum.io/rpc";

// ==================== MAIN ====================
async function getBlockNumber() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const blockNumber = await provider.getBlockNumber();
    console.log("Block:", blockNumber);
}

getBlockNumber().catch((err) => {
    console.error("Error:", err.message);
    process.exit(1);
});
