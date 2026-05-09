const { ethers } = require("ethers");

const RPC_URL = "https://arb1.arbitrum.io/rpc";
const CHAIN_ID = 42161;
const EXPRESS_LANE_AUCTION_ADDRESS = "0x5fcb496a31b7AE91e7c9078Ec662bd7A55cd3079";

const ERC20_ABI = [
    "function symbol() external view returns (string)",
    "function decimals() external view returns (uint8)",
];

const FALLBACK_ABI = [
    "function currentRound() external view returns (uint64)",
    "function roundTimingInfo() external view returns (int64 offsetTimestamp, uint64 roundDurationSeconds, uint64 auctionClosingSeconds, uint64 reserveSubmissionSeconds)",
    "function reservePrice() external view returns (uint256)",
    "function minReservePrice() external view returns (uint256)",
    "function beneficiary() external view returns (address)",
    "function beneficiaryBalance() external view returns (uint256)",
    "function biddingToken() external view returns (address)",
    "function roundTimestamps(uint64 round) external view returns (uint64 start, uint64 end)",
    "function resolvedRounds() external view returns (tuple(address expressLaneController, uint64 round) round1, tuple(address expressLaneController, uint64 round) round2)",
    "function isAuctionRoundClosed() external view returns (bool)",
];

async function loadAbi(chainId, address, provider, fallback) {
    try {
        const slot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
        const raw = await provider.getStorage(address, slot);
        const impl = raw && raw !== "0x" ? "0x" + raw.slice(-40) : null;
        const target = impl && impl !== "0x0000000000000000000000000000000000000000" ? impl : address;
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 5000);
        const res = await fetch(`https://sourcify.dev/server/files/any/${chainId}/${target}`, { signal: ctrl.signal });
        clearTimeout(timer);
        if (!res.ok) throw new Error(`Sourcify ${res.status}`);
        const body = await res.json();
        const meta = body.files?.find((f) => f.name === "metadata.json");
        if (!meta) throw new Error("metadata.json missing");
        return JSON.parse(meta.content).output.abi;
    } catch (err) {
        return fallback;
    }
}

async function getTimeboostCurrentState() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const abi = await loadAbi(CHAIN_ID, EXPRESS_LANE_AUCTION_ADDRESS, provider, FALLBACK_ABI);
    const auction = new ethers.Contract(EXPRESS_LANE_AUCTION_ADDRESS, abi, provider);

    console.log("TIMEBOOST CURRENT STATE");
    const [currentRound, timing, reservePrice, minReservePrice, beneficiary, beneficiaryBalance, biddingTokenAddr, isRoundClosed] = await Promise.all([
        auction.currentRound(),
        auction.roundTimingInfo(),
        auction.reservePrice(),
        auction.minReservePrice(),
        auction.beneficiary(),
        auction.beneficiaryBalance(),
        auction.biddingToken(),
        auction.isAuctionRoundClosed(),
    ]);

    const tokenContract = new ethers.Contract(biddingTokenAddr, ERC20_ABI, provider);
    const [tokenSymbol, tokenDecimals] = await Promise.all([
        tokenContract.symbol(),
        tokenContract.decimals(),
    ]);
    const fmt = (val) => ethers.formatUnits(val, tokenDecimals);

    console.log("Current round:", currentRound.toString());
    console.log("Round duration:", timing.roundDurationSeconds.toString(), "seconds");
    console.log("Auction closing window:", timing.auctionClosingSeconds.toString(), "seconds");
    console.log("Reserve submission window:", timing.reserveSubmissionSeconds.toString(), "seconds");
    console.log("Reserve price:", fmt(reservePrice), tokenSymbol);
    console.log("Min reserve price:", fmt(minReservePrice), tokenSymbol);
    console.log("Beneficiary:", beneficiary);
    console.log("Beneficiary balance:", fmt(beneficiaryBalance), tokenSymbol);
    console.log("Bidding token:", biddingTokenAddr, `(${tokenSymbol})`);
    console.log("Is auction round currently closed:", isRoundClosed);

    console.log("\nCURRENT ROUND DETAILS");
    const timestamps = await auction.roundTimestamps(currentRound);
    const [tsStart, tsEnd] = [timestamps[0] ?? timestamps.start, timestamps[1] ?? timestamps.end];
    console.log("Round start:", new Date(Number(tsStart) * 1000).toISOString());
    console.log("Round end:", new Date(Number(tsEnd) * 1000).toISOString());

    console.log("\nLATEST RESOLVED ROUNDS");
    const resolved = await auction.resolvedRounds();
    const [r1, r2] = [resolved[0] ?? resolved.round1, resolved[1] ?? resolved.round2];
    console.log(`Round ${(r1.round ?? r1[1]).toString()}: controller ${r1.expressLaneController ?? r1[0]}`);
    console.log(`Round ${(r2.round ?? r2[1]).toString()}: controller ${r2.expressLaneController ?? r2[0]}`);

    const nextRound = BigInt(currentRound) + 1n;
    const nextTimestamps = await auction.roundTimestamps(nextRound);
    const [nStart, nEnd] = [nextTimestamps[0] ?? nextTimestamps.start, nextTimestamps[1] ?? nextTimestamps.end];
    console.log("\nNEXT ROUND");
    console.log("Next round:", nextRound.toString());
    console.log("Round start:", new Date(Number(nStart) * 1000).toISOString());
    console.log("Round end:", new Date(Number(nEnd) * 1000).toISOString());
}

getTimeboostCurrentState().catch((err) => {
    console.error("Error fetching Timeboost current state:", err.message);
    process.exit(1);
});
