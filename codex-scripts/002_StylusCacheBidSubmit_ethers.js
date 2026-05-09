const { ethers } = require("ethers");

const RPC_URL = "https://arb1.arbitrum.io/rpc";
const PRIVATE_KEY = "YOUR_PRIVATE_KEY_HERE";
const CACHE_MANAGER_ADDRESS = "0x51dEDBD2f190E0696AFbEE5E60bFdE96d86464ec";
const PROGRAM_ADDRESS = "YOUR_STYLUS_PROGRAM_ADDRESS_HERE";
const BID_AMOUNT = ethers.parseEther("0.001");

const CACHE_MANAGER_ABI = [
    "function placeBid(address program) external payable",
    "function getMinBid(address program) external view returns (uint256)",
    "function isProgramCached(address program) external view returns (bool)",
];

async function submitCacheBid() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const cacheManager = new ethers.Contract(CACHE_MANAGER_ADDRESS, CACHE_MANAGER_ABI, wallet);

    console.log("Wallet:", wallet.address);
    console.log("Program:", PROGRAM_ADDRESS);

    // Check if already cached
    const isCached = await cacheManager.isProgramCached(PROGRAM_ADDRESS);
    if (isCached) {
        console.log("Program is already cached. No bid needed.");
        return;
    }

    // Get minimum bid
    const minBid = await cacheManager.getMinBid(PROGRAM_ADDRESS);
    console.log("Minimum bid:", ethers.formatEther(minBid), "ETH");

    // Ensure bid meets minimum
    const finalBid = BID_AMOUNT > minBid ? BID_AMOUNT : minBid;
    console.log("Submitting bid:", ethers.formatEther(finalBid), "ETH");

    // Submit the bid
    const tx = await cacheManager.placeBid(PROGRAM_ADDRESS, { value: finalBid });
    console.log("Transaction hash:", tx.hash);

    const receipt = await tx.wait();
    console.log("Confirmed in block:", receipt.blockNumber);
    console.log("Gas used:", receipt.gasUsed.toString());

    // Verify cache status
    const cachedAfter = await cacheManager.isProgramCached(PROGRAM_ADDRESS);
    console.log("Program cached:", cachedAfter);
}

submitCacheBid().catch((err) => {
    console.error("Error submitting cache bid:", err.message);
    process.exit(1);
});
