const { Web3 } = require("web3");

// ==================== CONFIGURATION ====================
const RPC_URL = "https://arb1.arbitrum.io/rpc";

// ==================== MAIN ====================
async function getBlockNumber() {
    const web3 = new Web3(RPC_URL);
    const blockNumber = await web3.eth.getBlockNumber();
    console.log("Block:", blockNumber.toString());
}

getBlockNumber().catch((err) => {
    console.error("Error:", err.message);
    process.exit(1);
});
