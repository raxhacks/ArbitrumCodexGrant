const { Web3 } = require("web3");

// ==================== CONFIGURATION ====================
const RPC_URL = "https://arb1.arbitrum.io/rpc";
const ARB_GAS_INFO_ADDRESS = "0x000000000000000000000000000000000000006C";

// ==================== ABI ====================
const ARB_GAS_INFO_ABI = [
    {
        name: "getPricesInWei",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [
            { name: "", type: "uint256" },
            { name: "", type: "uint256" },
            { name: "", type: "uint256" },
            { name: "", type: "uint256" },
            { name: "", type: "uint256" },
            { name: "", type: "uint256" },
        ],
    },
    {
        name: "getPricesInArbGas",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [
            { name: "", type: "uint256" },
            { name: "", type: "uint256" },
            { name: "", type: "uint256" },
        ],
    },
    {
        name: "getGasBacklog",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint64" }],
    },
    {
        name: "getL1BaseFeeEstimate",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
    },
    {
        name: "getL1BaseFeeEstimateInertia",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint64" }],
    },
    {
        name: "getL2BaseFee",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
    },
    {
        name: "getMinimumGasPrice",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
    },
    {
        name: "getGasPoolSeconds",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint64" }],
    },
    {
        name: "getGasPoolTarget",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint64" }],
    },
    {
        name: "getGasPoolWeight",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint64" }],
    },
    {
        name: "getRateEstimate",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint64" }],
    },
    {
        name: "getL1RewardRate",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint64" }],
    },
    {
        name: "getL1RewardRecipient",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "address" }],
    },
    {
        name: "getL1GasPriceEstimate",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
    },
    {
        name: "getCurrentTxL1GasFees",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
    },
    {
        name: "getAmortizedCostCapBips",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint64" }],
    },
    {
        name: "getL1FeesAvailable",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
    },
    {
        name: "getL1PricingEquilibrationUnits",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
    },
    {
        name: "getLastL1PricingUpdateTime",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint64" }],
    },
    {
        name: "getL1PricingFundsDueForRewards",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
    },
    {
        name: "getL1PricingSurplus",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "int256" }],
    },
];

// ==================== MAIN ====================
async function getArbGasInfo() {
    const web3 = new Web3(RPC_URL);
    const gasInfo = new web3.eth.Contract(ARB_GAS_INFO_ABI, ARB_GAS_INFO_ADDRESS);

    const fmtGwei = (val) => Web3.utils.fromWei(val.toString(), "gwei");
    const fmtEther = (val) => Web3.utils.fromWei(val.toString(), "ether");

    // Fetch all data in parallel — wrap each call so one failure doesn't abort all
    const safe = (promise) => promise.catch(() => null);
    const [
        l2BaseFee, minGasPrice,
        l1BaseFee, l1GasPrice, l1Inertia,
        pricesWei, pricesArbGas,
        gasBacklog, gasPoolSeconds, gasPoolTarget, gasPoolWeight, rateEstimate,
        l1RewardRate, l1RewardRecipient, l1FeesAvailable, l1PricingEquil,
        lastL1Update, l1FundsDue, l1Surplus, amortizedCapBips, currentTxL1Fees,
    ] = await Promise.all([
        safe(gasInfo.methods.getL2BaseFee().call()), safe(gasInfo.methods.getMinimumGasPrice().call()),
        safe(gasInfo.methods.getL1BaseFeeEstimate().call()), safe(gasInfo.methods.getL1GasPriceEstimate().call()), safe(gasInfo.methods.getL1BaseFeeEstimateInertia().call()),
        safe(gasInfo.methods.getPricesInWei().call()), safe(gasInfo.methods.getPricesInArbGas().call()),
        safe(gasInfo.methods.getGasBacklog().call()), safe(gasInfo.methods.getGasPoolSeconds().call()), safe(gasInfo.methods.getGasPoolTarget().call()), safe(gasInfo.methods.getGasPoolWeight().call()), safe(gasInfo.methods.getRateEstimate().call()),
        safe(gasInfo.methods.getL1RewardRate().call()), safe(gasInfo.methods.getL1RewardRecipient().call()), safe(gasInfo.methods.getL1FeesAvailable().call()), safe(gasInfo.methods.getL1PricingEquilibrationUnits().call()),
        safe(gasInfo.methods.getLastL1PricingUpdateTime().call()), safe(gasInfo.methods.getL1PricingFundsDueForRewards().call()), safe(gasInfo.methods.getL1PricingSurplus().call()), safe(gasInfo.methods.getAmortizedCostCapBips().call()), safe(gasInfo.methods.getCurrentTxL1GasFees().call()),
    ]);

    const show = (label, val, unit, formatter) => {
        if (val == null) return console.log(label, "N/A (call reverted)");
        const formatted = formatter ? formatter(val) : val.toString();
        console.log(label, formatted, unit || "");
    };

    // L2 Gas Prices
    console.log("==================== L2 GAS PRICES ====================");
    show("L2 base fee:", l2BaseFee, "gwei", fmtGwei);
    show("Minimum gas price:", minGasPrice, "gwei", fmtGwei);

    // L1 Fee Estimates
    console.log("\n==================== L1 FEE ESTIMATES ====================");
    show("L1 base fee estimate:", l1BaseFee, "gwei", fmtGwei);
    show("L1 gas price estimate:", l1GasPrice, "gwei", fmtGwei);
    show("L1 base fee inertia:", l1Inertia);

    // Prices in Wei (detailed breakdown)
    console.log("\n==================== PRICES IN WEI ====================");
    if (pricesWei) {
        console.log("Per L2 tx:", fmtGwei(pricesWei[0]), "gwei");
        console.log("Per L1 calldata unit:", fmtGwei(pricesWei[1]), "gwei");
        console.log("Per storage alloc:", fmtGwei(pricesWei[2]), "gwei");
        console.log("Per ArbGas base:", fmtGwei(pricesWei[3]), "gwei");
        console.log("Per ArbGas congestion:", fmtGwei(pricesWei[4]), "gwei");
        console.log("Per ArbGas total:", fmtGwei(pricesWei[5]), "gwei");
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
    show("L1 fees available:", l1FeesAvailable, "ETH", fmtEther);
    show("L1 pricing equilibration units:", l1PricingEquil);
    if (lastL1Update != null) {
        console.log("Last L1 pricing update:", new Date(Number(lastL1Update) * 1000).toISOString());
    } else {
        console.log("Last L1 pricing update: N/A (call reverted)");
    }
    show("L1 funds due for rewards:", l1FundsDue, "ETH", fmtEther);
    show("L1 pricing surplus:", l1Surplus, "ETH", fmtEther);
    show("Amortized cost cap (bips):", amortizedCapBips);

    // Current tx cost
    console.log("\n==================== CURRENT TX L1 FEES ====================");
    show("Current tx L1 gas fees:", currentTxL1Fees, "gwei", fmtGwei);
}

getArbGasInfo().catch((err) => {
    console.error("Error fetching gas info:", err.message);
    process.exit(1);
});
