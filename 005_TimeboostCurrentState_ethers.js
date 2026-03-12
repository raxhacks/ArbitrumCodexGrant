const { ethers } = require("ethers");

// ==================== CONFIGURATION ====================
const RPC_URL = "https://arb1.arbitrum.io/rpc";
const EXPRESS_LANE_AUCTION_ADDRESS = "0x00a0F15B79D1D3E5991929FaAbCf2Aa65623530d";

// ==================== ABI ====================
const EXPRESS_LANE_AUCTION_ABI = [
    "function currentRound() external view returns (uint64)",
    "function roundDurationSeconds() external view returns (uint64)",
    "function reservePrice() external view returns (uint256)",
    "function minReservePrice() external view returns (uint256)",
    "function beneficiary() external view returns (address)",
    "function beneficiaryBalance() external view returns (uint256)",
    "function biddingToken() external view returns (address)",
    "function auctioneer() external view returns (address)",
    "function expressLaneControllerByRound(uint64 round) external view returns (address)",
    "function roundTimestamps(uint64 round) external view returns (uint64 start, uint64 end)",
];

const ERC20_ABI = [
    "function symbol() external view returns (string)",
    "function decimals() external view returns (uint8)",
];

// ==================== MAIN ====================
async function getTimeboostCurrentState() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const auction = new ethers.Contract(EXPRESS_LANE_AUCTION_ADDRESS, EXPRESS_LANE_AUCTION_ABI, provider);

    console.log("==================== TIMEBOOST CURRENT STATE ====================");
    const [currentRound, roundDuration, reservePrice, minReservePrice, beneficiary, beneficiaryBalance, biddingTokenAddr, auctioneer] = await Promise.all([
        auction.currentRound(),
        auction.roundDurationSeconds(),
        auction.reservePrice(),
        auction.minReservePrice(),
        auction.beneficiary(),
        auction.beneficiaryBalance(),
        auction.biddingToken(),
        auction.auctioneer(),
    ]);

    // Fetch bidding token info for proper formatting
    const tokenContract = new ethers.Contract(biddingTokenAddr, ERC20_ABI, provider);
    const [tokenSymbol, tokenDecimals] = await Promise.all([
        tokenContract.symbol(),
        tokenContract.decimals(),
    ]);
    const fmt = (val) => ethers.formatUnits(val, tokenDecimals);

    console.log("Current round:", currentRound.toString());
    console.log("Round duration:", roundDuration.toString(), "seconds");
    console.log("Reserve price:", fmt(reservePrice), tokenSymbol);
    console.log("Min reserve price:", fmt(minReservePrice), tokenSymbol);
    console.log("Beneficiary:", beneficiary);
    console.log("Beneficiary balance:", fmt(beneficiaryBalance), tokenSymbol);
    console.log("Bidding token:", biddingTokenAddr, `(${tokenSymbol})`);
    console.log("Auctioneer:", auctioneer);

    // Current round details
    console.log("\n==================== CURRENT ROUND DETAILS ====================");
    const controller = await auction.expressLaneControllerByRound(currentRound);
    const timestamps = await auction.roundTimestamps(currentRound);

    console.log("Express lane controller:", controller);
    console.log("Round start:", new Date(Number(timestamps.start) * 1000).toISOString());
    console.log("Round end:", new Date(Number(timestamps.end) * 1000).toISOString());

    // Next round
    const nextRound = BigInt(currentRound) + 1n;
    const nextController = await auction.expressLaneControllerByRound(nextRound);
    const nextTimestamps = await auction.roundTimestamps(nextRound);

    console.log("\n==================== NEXT ROUND DETAILS ====================");
    console.log("Next round:", nextRound.toString());
    console.log("Express lane controller:", nextController);
    console.log("Round start:", new Date(Number(nextTimestamps.start) * 1000).toISOString());
    console.log("Round end:", new Date(Number(nextTimestamps.end) * 1000).toISOString());
}

getTimeboostCurrentState().catch((err) => {
    console.error("Error fetching Timeboost current state:", err.message);
    process.exit(1);
});
