const { ethers } = require("ethers");

const CHAIN_ID = 42161; // Change this to check any chain

const RPC_BY_CHAIN_ID = {
    42161: "https://arb1.arbitrum.io/rpc",           // Arbitrum One
    42170: "https://nova.arbitrum.io/rpc",            // Arbitrum Nova
    421614: "https://sepolia-rollup.arbitrum.io/rpc", // Arbitrum Sepolia
};

const AUCTION_BY_CHAIN_ID = {
    42161: "0x5fcb496a31b7AE91e7c9078Ec662bd7A55cd3079",  // Arbitrum One
    42170: "0x5fcb496a31b7AE91e7c9078Ec662bd7A55cd3079",  // Arbitrum Nova (update if different)
    421614: "0x5fcb496a31b7AE91e7c9078Ec662bd7A55cd3079", // Arbitrum Sepolia (update if different)
};

const EXPRESS_LANE_AUCTION_ABI = [
    "function currentRound() external view returns (uint64)",
    "function roundTimingInfo() external view returns (int64 offsetTimestamp, uint64 roundDurationSeconds, uint64 auctionClosingSeconds, uint64 reserveSubmissionSeconds)",
    "function reservePrice() external view returns (uint256)",
    "function biddingToken() external view returns (address)",
];

const ERC20_ABI = [
    "function symbol() external view returns (string)",
    "function decimals() external view returns (uint8)",
];

async function detectTimeboost() {
    const rpcUrl = RPC_BY_CHAIN_ID[CHAIN_ID];
    if (!rpcUrl) {
        console.log(`No known RPC endpoint for chain ID ${CHAIN_ID}`);
        console.log("Timeboost status: UNKNOWN");
        process.exit(1);
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);

    // Verify chain ID
    const network = await provider.getNetwork();
    const connectedChainId = Number(network.chainId);
    if (connectedChainId !== CHAIN_ID) {
        console.log(`Chain ID mismatch: expected ${CHAIN_ID}, got ${connectedChainId}`);
        process.exit(1);
    }

    console.log(`TIMEBOOST DETECTION (Chain ${CHAIN_ID})`);

    const auctionAddress = AUCTION_BY_CHAIN_ID[CHAIN_ID];
    if (!auctionAddress) {
        console.log("No known ExpressLaneAuction address for this chain.");
        console.log("Timeboost status: NOT AVAILABLE");
        return;
    }

    // Check if contract exists at the address
    const code = await provider.getCode(auctionAddress);
    if (code === "0x") {
        console.log(`No contract deployed at ${auctionAddress}`);
        console.log("Timeboost status: NOT DEPLOYED");
        return;
    }

    console.log(`ExpressLaneAuction contract found at ${auctionAddress}`);

    // Try calling contract functions to verify it's active
    const auction = new ethers.Contract(auctionAddress, EXPRESS_LANE_AUCTION_ABI, provider);

    try {
        const [currentRound, timing, reservePrice, biddingTokenAddress] = await Promise.all([
            auction.currentRound(),
            auction.roundTimingInfo(),
            auction.reservePrice(),
            auction.biddingToken(),
        ]);
        const roundDuration = timing.roundDurationSeconds ?? timing[1];

        const biddingToken = new ethers.Contract(biddingTokenAddress, ERC20_ABI, provider);
        const [symbol, decimals] = await Promise.all([
            biddingToken.symbol(),
            biddingToken.decimals(),
        ]);

        const isActive = Number(currentRound) > 0 || Number(roundDuration) > 0;

        console.log("Current round:", currentRound.toString());
        console.log("Round duration:", roundDuration.toString(), "seconds");
        console.log("Bidding token:", biddingTokenAddress, `(${symbol})`);
        console.log("Reserve price:", ethers.formatUnits(reservePrice, decimals), symbol);
        console.log("");
        console.log("Timeboost status:", isActive ? "ACTIVE" : "INACTIVE");
    } catch (err) {
        console.log("Contract exists but calls failed:", err.message);
        console.log("Timeboost status: DEPLOYED BUT NOT FUNCTIONAL");
    }
}

detectTimeboost().catch((err) => {
    console.error("Error detecting Timeboost:", err.message);
    process.exit(1);
});
