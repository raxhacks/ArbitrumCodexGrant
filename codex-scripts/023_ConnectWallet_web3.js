const { Web3 } = require("web3");

// ==================== CONFIGURATION ====================
const RPC_URL = "https://arb1.arbitrum.io/rpc";
const PRIVATE_KEY = "YOUR_PRIVATE_KEY_HERE";

// ==================== KNOWN CHAINS ====================
const CHAINS = {
    1: { name: "Ethereum Mainnet", currency: "ETH" },
    42161: { name: "Arbitrum One", currency: "ETH" },
    42170: { name: "Arbitrum Nova", currency: "ETH" },
    421614: { name: "Arbitrum Sepolia", currency: "ETH" },
    10: { name: "Optimism", currency: "ETH" },
    137: { name: "Polygon", currency: "MATIC" },
    56: { name: "BNB Chain", currency: "BNB" },
    43114: { name: "Avalanche", currency: "AVAX" },
    8453: { name: "Base", currency: "ETH" },
    11155111: { name: "Sepolia", currency: "ETH" },
};

// ==================== MAIN ====================
async function connectWallet() {
    // Connect provider
    console.log("==================== CONNECTING ====================");
    console.log("RPC:", RPC_URL);

    const web3 = new Web3(RPC_URL);

    // Test connection
    let blockNumber;
    try {
        blockNumber = Number(await web3.eth.getBlockNumber());
        console.log("Connection: SUCCESS");
    } catch (err) {
        console.log("Connection: FAILED");
        console.log("Error:", err.message);
        process.exit(1);
    }

    // Network info
    const chainId = Number(await web3.eth.getChainId());
    const chainInfo = CHAINS[chainId] || { name: "Unknown", currency: "ETH" };

    console.log("\n==================== NETWORK ====================");
    console.log("Chain ID:", chainId);
    console.log("Network:", chainInfo.name);
    console.log("Currency:", chainInfo.currency);
    console.log("Current block:", blockNumber);

    // Get latest block details
    const block = await web3.eth.getBlock(blockNumber);
    console.log("Block timestamp:", new Date(Number(block.timestamp) * 1000).toISOString());
    console.log("Block gas limit:", block.gasLimit.toString());

    // Fee data
    const gasPrice = await web3.eth.getGasPrice();
    console.log("\n==================== GAS FEES ====================");
    console.log("Gas price:", Web3.utils.fromWei(gasPrice, "gwei"), "gwei");

    try {
        const feeHistory = await web3.eth.getFeeHistory(1, "latest", [25, 50, 75]);
        if (feeHistory.baseFeePerGas && feeHistory.baseFeePerGas.length > 0) {
            console.log("Base fee:", Web3.utils.fromWei(feeHistory.baseFeePerGas[0].toString(), "gwei"), "gwei");
        }
        if (feeHistory.reward && feeHistory.reward.length > 0) {
            console.log("Priority fee (25th):", Web3.utils.fromWei(feeHistory.reward[0][0].toString(), "gwei"), "gwei");
            console.log("Priority fee (50th):", Web3.utils.fromWei(feeHistory.reward[0][1].toString(), "gwei"), "gwei");
            console.log("Priority fee (75th):", Web3.utils.fromWei(feeHistory.reward[0][2].toString(), "gwei"), "gwei");
        }
    } catch {
        console.log("Fee history: N/A");
    }

    // Connect wallet
    console.log("\n==================== WALLET ====================");
    const account = web3.eth.accounts.privateKeyToAccount(PRIVATE_KEY);
    web3.eth.accounts.wallet.add(account);

    console.log("Address:", account.address);

    // Balances
    const balance = await web3.eth.getBalance(account.address);
    console.log("Balance:", Web3.utils.fromWei(balance, "ether"), chainInfo.currency);

    // Transaction count (nonce)
    const nonce = Number(await web3.eth.getTransactionCount(account.address));
    console.log("Nonce (tx count):", nonce);

    // Pending nonce
    const pendingNonce = Number(await web3.eth.getTransactionCount(account.address, "pending"));
    console.log("Pending nonce:", pendingNonce);
    if (pendingNonce > nonce) {
        console.log("Pending transactions:", pendingNonce - nonce);
    }

    // Check if address is a contract
    const walletCode = await web3.eth.getCode(account.address);
    console.log("Is EOA:", walletCode === "0x");

    // Sign a test message to verify wallet works
    console.log("\n==================== SIGN TEST ====================");
    const testMessage = "Wallet connection test";
    const signature = account.sign(testMessage);
    const recovered = web3.eth.accounts.recover(testMessage, signature.v, signature.r, signature.s);

    console.log("Test message:", testMessage);
    console.log("Message hash:", signature.messageHash);
    console.log("Signature:", signature.signature);
    console.log("Recovered:", recovered);
    console.log("Verified:", recovered.toLowerCase() === account.address.toLowerCase());

    // Summary
    console.log("\n==================== CONNECTION SUMMARY ====================");
    console.log("Status: CONNECTED");
    console.log("Network:", chainInfo.name, `(${chainId})`);
    console.log("Address:", account.address);
    console.log("Balance:", Web3.utils.fromWei(balance, "ether"), chainInfo.currency);
    console.log("Nonce:", nonce);
    console.log("Block:", blockNumber);
}

connectWallet().catch((err) => {
    console.error("Error connecting wallet:", err.message);
    process.exit(1);
});
