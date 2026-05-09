const { ethers } = require("ethers");

const RPC_URL = "https://arb1.arbitrum.io/rpc";
const PRIVATE_KEY = process.env.PRIVATE_KEY || ethers.Wallet.createRandom().privateKey;

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

async function connectWallet() {
    // Connect provider
    console.log("CONNECTING");
    console.log("RPC:", RPC_URL);

    const provider = new ethers.JsonRpcProvider(RPC_URL);

    // Test connection
    let blockNumber;
    try {
        blockNumber = await provider.getBlockNumber();
        console.log("Connection: SUCCESS");
    } catch (err) {
        console.log("Connection: FAILED");
        console.log("Error:", err.message);
        process.exit(1);
    }

    // Network info
    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);
    const chainInfo = CHAINS[chainId] || { name: "Unknown", currency: "ETH" };

    console.log("\nNETWORK");
    console.log("Chain ID:", chainId);
    console.log("Network:", chainInfo.name);
    console.log("Currency:", chainInfo.currency);
    console.log("Current block:", blockNumber);

    // Get latest block details
    const block = await provider.getBlock(blockNumber);
    console.log("Block timestamp:", new Date(block.timestamp * 1000).toISOString());
    console.log("Block gas limit:", block.gasLimit.toString());

    // Fee data
    const feeData = await provider.getFeeData();
    console.log("\nGAS FEES");
    console.log("Gas price:", feeData.gasPrice ? ethers.formatUnits(feeData.gasPrice, "gwei") + " gwei" : "N/A");
    console.log("Max fee per gas:", feeData.maxFeePerGas ? ethers.formatUnits(feeData.maxFeePerGas, "gwei") + " gwei" : "N/A");
    console.log("Max priority fee:", feeData.maxPriorityFeePerGas ? ethers.formatUnits(feeData.maxPriorityFeePerGas, "gwei") + " gwei" : "N/A");

    // Connect wallet
    console.log("\nWALLET");
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    console.log("Address:", wallet.address);
    console.log("Public key:", wallet.publicKey);

    // Balances
    const balance = await provider.getBalance(wallet.address);
    console.log("Balance:", ethers.formatEther(balance), chainInfo.currency);

    // Transaction count (nonce)
    const nonce = await provider.getTransactionCount(wallet.address);
    console.log("Nonce (tx count):", nonce);

    // Pending nonce
    const pendingNonce = await provider.getTransactionCount(wallet.address, "pending");
    console.log("Pending nonce:", pendingNonce);
    if (pendingNonce > nonce) {
        console.log("Pending transactions:", pendingNonce - nonce);
    }

    // Check if address is a contract
    const walletCode = await provider.getCode(wallet.address);
    console.log("Is EOA:", walletCode === "0x");

    // Sign a test message to verify wallet works
    console.log("\nSIGN TEST");
    const testMessage = "Wallet connection test";
    const signature = await wallet.signMessage(testMessage);
    const recovered = ethers.verifyMessage(testMessage, signature);

    console.log("Test message:", testMessage);
    console.log("Signature:", signature);
    console.log("Recovered:", recovered);
    console.log("Verified:", recovered.toLowerCase() === wallet.address.toLowerCase());

    // Summary
    console.log("\nCONNECTION SUMMARY");
    console.log("Status: CONNECTED");
    console.log("Network:", chainInfo.name, `(${chainId})`);
    console.log("Address:", wallet.address);
    console.log("Balance:", ethers.formatEther(balance), chainInfo.currency);
    console.log("Nonce:", nonce);
    console.log("Block:", blockNumber);
}

connectWallet().catch((err) => {
    console.error("Error connecting wallet:", err.message);
    process.exit(1);
});
