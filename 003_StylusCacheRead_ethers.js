const { ethers } = require("ethers");

// ==================== CONFIGURATION ====================
const RPC_URL = "https://arb1.arbitrum.io/rpc";
const CACHE_MANAGER_ADDRESS = "0xd1bBD579B127Fc8eD1cF40E8bbcf2EFBc07787AD";

// ==================== ABI ====================
const CACHE_MANAGER_ABI = [
    "function getEntries() external view returns (tuple(bytes32 code, uint64 size, uint192 bid)[])",
    "function cacheSize() external view returns (uint64)",
    "function queueSize() external view returns (uint64)",
    "function isProgramCached(address program) external view returns (bool)",
    "function getMinBid(address program) external view returns (uint256)",
    "function getMinBid(uint64 size) external view returns (uint256)",
];

// ==================== MAIN ====================
async function readCache() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const cacheManager = new ethers.Contract(CACHE_MANAGER_ADDRESS, CACHE_MANAGER_ABI, provider);

    // Get cache stats
    const cacheSize = await cacheManager.cacheSize();
    const queueSize = await cacheManager.queueSize();
    console.log("==================== CACHE STATS ====================");
    console.log("Cache size:", cacheSize.toString(), "bytes");
    console.log("Queue size:", queueSize.toString());

    // Get all cached entries
    const entries = await cacheManager.getEntries();
    console.log("Total cached contracts:", entries.length);
    console.log("");

    // Display all cached contracts
    console.log("==================== CACHED CONTRACTS ====================");
    entries.forEach((entry, index) => {
        console.log(`\n--- Entry ${index + 1} ---`);
        console.log("Codehash:", entry.code);
        console.log("Size:", entry.size.toString(), "bytes");
        console.log("Bid:", ethers.formatEther(entry.bid), "ETH");
    });
}

readCache().catch((err) => {
    console.error("Error reading cache:", err.message);
    process.exit(1);
});
