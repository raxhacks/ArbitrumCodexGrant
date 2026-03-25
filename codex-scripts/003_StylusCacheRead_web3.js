const { Web3 } = require("web3");

// ==================== CONFIGURATION ====================
const RPC_URL = "https://arb1.arbitrum.io/rpc";
const CACHE_MANAGER_ADDRESS = "0xd1bBD579B127Fc8eD1cF40E8bbcf2EFBc07787AD";

// ==================== ABI ====================
const CACHE_MANAGER_ABI = [
    {
        name: "getEntries",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [
            {
                name: "",
                type: "tuple[]",
                components: [
                    { name: "code", type: "bytes32" },
                    { name: "size", type: "uint64" },
                    { name: "bid", type: "uint192" },
                ],
            },
        ],
    },
    {
        name: "cacheSize",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint64" }],
    },
    {
        name: "queueSize",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint64" }],
    },
    {
        name: "isProgramCached",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "program", type: "address" }],
        outputs: [{ name: "", type: "bool" }],
    },
    {
        name: "getMinBid",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "program", type: "address" }],
        outputs: [{ name: "", type: "uint256" }],
    },
];

// ==================== MAIN ====================
async function readCache() {
    const web3 = new Web3(RPC_URL);
    const cacheManager = new web3.eth.Contract(CACHE_MANAGER_ABI, CACHE_MANAGER_ADDRESS);

    // Get cache stats
    const cacheSize = await cacheManager.methods.cacheSize().call();
    const queueSize = await cacheManager.methods.queueSize().call();
    console.log("==================== CACHE STATS ====================");
    console.log("Cache size:", cacheSize.toString(), "bytes");
    console.log("Queue size:", queueSize.toString());

    // Get all cached entries
    const entries = await cacheManager.methods.getEntries().call();
    console.log("Total cached contracts:", entries.length);
    console.log("");

    // Display all cached contracts
    console.log("==================== CACHED CONTRACTS ====================");
    entries.forEach((entry, index) => {
        console.log(`\n--- Entry ${index + 1} ---`);
        console.log("Codehash:", entry.code);
        console.log("Size:", entry.size.toString(), "bytes");
        console.log("Bid:", Web3.utils.fromWei(entry.bid, "ether"), "ETH");
    });
}

readCache().catch((err) => {
    console.error("Error reading cache:", err.message);
    process.exit(1);
});
