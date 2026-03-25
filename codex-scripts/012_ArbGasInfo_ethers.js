const { ethers } = require("ethers");

// ==================== CONFIGURATION ====================
const RPC_URL = "https://arb1.arbitrum.io/rpc";
const ARB_GAS_INFO_ADDRESS = "0x000000000000000000000000000000000000006C";

// ==================== ABI ====================
const ARB_GAS_INFO_ABI = [
    "function getPricesInWei() external view returns (uint256, uint256, uint256, uint256, uint256, uint256)",
    "function getPricesInArbGas() external view returns (uint256, uint256, uint256)",
    "function getGasBacklog() external view returns (uint64)",
    "function getL1BaseFeeEstimate() external view returns (uint256)",
    "function getL1BaseFeeEstimateInertia() external view returns (uint64)",
    "function getL2BaseFee() external view returns (uint256)",
    "function getMinimumGasPrice() external view returns (uint256)",
    "function getGasPoolSeconds() external view returns (uint64)",
    "function getGasPoolTarget() external view returns (uint64)",
    "function getGasPoolWeight() external view returns (uint64)",
    "function getRateEstimate() external view returns (uint64)",
    "function getL1RewardRate() external view returns (uint64)",
    "function getL1RewardRecipient() external view returns (address)",
    "function getL1GasPriceEstimate() external view returns (uint256)",
    "function getCurrentTxL1GasFees() external view returns (uint256)",
    "function getAmortizedCostCapBips() external view returns (uint64)",
    "function getL1FeesAvailable() external view returns (uint256)",
    "function getL1PricingEquilibrationUnits() external view returns (uint256)",
    "function getLastL1PricingUpdateTime() external view returns (uint64)",
    "function getL1PricingFundsDueForRewards() external view returns (uint256)",
    "function getL1PricingSurplus() external view returns (int256)",
];

// ==================== MAIN ====================
async function getArbGasInfo() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const gasInfo = new ethers.Contract(ARB_GAS_INFO_ADDRESS, ARB_GAS_INFO_ABI, provider);

    // Fetch all data in parallel — wrap each call so one failure doesn't abort all
    const safe = (fn) => fn.catch(() => null);
    const [
        l2BaseFee, minGasPrice,
        l1BaseFee, l1GasPrice, l1Inertia,
        pricesWei, pricesArbGas,
        gasBacklog, gasPoolSeconds, gasPoolTarget, gasPoolWeight, rateEstimate,
        l1RewardRate, l1RewardRecipient, l1FeesAvailable, l1PricingEquil,
        lastL1Update, l1FundsDue, l1Surplus, amortizedCapBips, currentTxL1Fees,
    ] = await Promise.all([
        safe(gasInfo.getL2BaseFee()), safe(gasInfo.getMinimumGasPrice()),
        safe(gasInfo.getL1BaseFeeEstimate()), safe(gasInfo.getL1GasPriceEstimate()), safe(gasInfo.getL1BaseFeeEstimateInertia()),
        safe(gasInfo.getPricesInWei()), safe(gasInfo.getPricesInArbGas()),
        safe(gasInfo.getGasBacklog()), safe(gasInfo.getGasPoolSeconds()), safe(gasInfo.getGasPoolTarget()), safe(gasInfo.getGasPoolWeight()), safe(gasInfo.getRateEstimate()),
        safe(gasInfo.getL1RewardRate()), safe(gasInfo.getL1RewardRecipient()), safe(gasInfo.getL1FeesAvailable()), safe(gasInfo.getL1PricingEquilibrationUnits()),
        safe(gasInfo.getLastL1PricingUpdateTime()), safe(gasInfo.getL1PricingFundsDueForRewards()), safe(gasInfo.getL1PricingSurplus()), safe(gasInfo.getAmortizedCostCapBips()), safe(gasInfo.getCurrentTxL1GasFees()),
    ]);

    const show = (label, val, unit, formatter) => {
        if (val == null) return console.log(label, "N/A (call reverted)");
        const formatted = formatter ? formatter(val) : val.toString();
        console.log(label, formatted, unit || "");
    };
    const gwei = (v) => ethers.formatUnits(v, "gwei");
    const ether = (v) => ethers.formatEther(v);

    // L2 Gas Prices
    console.log("==================== L2 GAS PRICES ====================");
    show("L2 base fee:", l2BaseFee, "gwei", gwei);
    show("Minimum gas price:", minGasPrice, "gwei", gwei);

    // L1 Fee Estimates
    console.log("\n==================== L1 FEE ESTIMATES ====================");
    show("L1 base fee estimate:", l1BaseFee, "gwei", gwei);
    show("L1 gas price estimate:", l1GasPrice, "gwei", gwei);
    show("L1 base fee inertia:", l1Inertia);

    // Prices in Wei (detailed breakdown)
    console.log("\n==================== PRICES IN WEI ====================");
    if (pricesWei) {
        console.log("Per L2 tx:", gwei(pricesWei[0]), "gwei");
        console.log("Per L1 calldata unit:", gwei(pricesWei[1]), "gwei");
        console.log("Per storage alloc:", gwei(pricesWei[2]), "gwei");
        console.log("Per ArbGas base:", gwei(pricesWei[3]), "gwei");
        console.log("Per ArbGas congestion:", gwei(pricesWei[4]), "gwei");
        console.log("Per ArbGas total:", gwei(pricesWei[5]), "gwei");
    } else {
        console.log("getPricesInWei() not available (deprecated on this chain version)");
    }

    // Prices in ArbGas
    console.log("\n==================== PRICES IN ARBGAS ====================");
    if (pricesArbGas) {
        console.log("Per L2 tx:", pricesArbGas[0].toString());
        console.log("Per L1 calldata unit:", pricesArbGas[1].toString());
        console.log("Per storage alloc:", pricesArbGas[2].toString());
    } else {
        console.log("getPricesInArbGas() not available (deprecated on this chain version)");
    }

    // Gas Pool
    console.log("\n==================== GAS POOL ====================");
    show("Gas backlog:", gasBacklog);
    show("Gas pool seconds:", gasPoolSeconds);
    show("Gas pool target:", gasPoolTarget);
    show("Gas pool weight:", gasPoolWeight);
    show("Rate estimate:", rateEstimate);

    // L1 Pricing
    console.log("\n==================== L1 PRICING ====================");
    show("L1 reward rate:", l1RewardRate);
    show("L1 reward recipient:", l1RewardRecipient);
    show("L1 fees available:", l1FeesAvailable, "ETH", ether);
    show("L1 pricing equilibration units:", l1PricingEquil);
    if (lastL1Update != null) {
        console.log("Last L1 pricing update:", new Date(Number(lastL1Update) * 1000).toISOString());
    } else {
        console.log("Last L1 pricing update: N/A (call reverted)");
    }
    show("L1 funds due for rewards:", l1FundsDue, "ETH", ether);
    show("L1 pricing surplus:", l1Surplus, "ETH", ether);
    show("Amortized cost cap (bips):", amortizedCapBips);

    // Current tx cost
    console.log("\n==================== CURRENT TX L1 FEES ====================");
    show("Current tx L1 gas fees:", currentTxL1Fees, "gwei", gwei);
}

getArbGasInfo().catch((err) => {
    console.error("Error fetching gas info:", err.message);
    process.exit(1);
});
