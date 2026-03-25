const { ethers } = require("ethers");

// ==================== CONFIGURATION ====================
const RPC_URL = "https://arb1.arbitrum.io/rpc";
const CONTRACT_ADDRESS = "YOUR_CONTRACT_ADDRESS_HERE";

// ==================== ABI ====================
// Replace with your contract's ABI (view/pure functions you want to read)
const CONTRACT_ABI = [
    "function name() external view returns (string)",
    "function symbol() external view returns (string)",
    "function decimals() external view returns (uint8)",
    "function totalSupply() external view returns (uint256)",
    "function balanceOf(address account) external view returns (uint256)",
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function owner() external view returns (address)",
    "function paused() external view returns (bool)",
    "function get() external view returns (uint256)",
];

// ==================== FUNCTIONS TO CALL ====================
// Each entry: { name: "functionName", args: [arg1, arg2, ...] }
const CALLS = [
    { name: "name", args: [] },
    { name: "symbol", args: [] },
    { name: "decimals", args: [] },
    { name: "totalSupply", args: [] },
    { name: "owner", args: [] },
    // { name: "balanceOf", args: ["0xYourAddressHere"] },
    // { name: "allowance", args: ["0xOwner", "0xSpender"] },
];

// ==================== MAIN ====================
async function readContract() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    // Verify contract exists
    const code = await provider.getCode(CONTRACT_ADDRESS);
    if (code === "0x") {
        console.log("No contract at:", CONTRACT_ADDRESS);
        process.exit(1);
    }

    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
    const iface = new ethers.Interface(CONTRACT_ABI);

    console.log("==================== CONTRACT ====================");
    console.log("Address:", CONTRACT_ADDRESS);
    console.log("Bytecode size:", (code.length - 2) / 2, "bytes");

    // List available view functions
    console.log("\n==================== AVAILABLE FUNCTIONS ====================");
    iface.fragments.forEach((fragment) => {
        if (fragment.type === "function" && (fragment.stateMutability === "view" || fragment.stateMutability === "pure")) {
            const inputs = fragment.inputs.map((i) => `${i.type} ${i.name}`).join(", ");
            const outputs = fragment.outputs.map((o) => `${o.type} ${o.name || ""}`).join(", ");
            console.log(`  ${fragment.name}(${inputs}) -> (${outputs})`);
        }
    });

    // Execute calls
    console.log("\n==================== RESULTS ====================");

    for (const call of CALLS) {
        const { name, args } = call;

        try {
            // Get function fragment for output formatting
            const fragment = iface.getFunction(name);
            const encodedData = iface.encodeFunctionData(name, args);

            const result = await contract[name](...args);

            console.log(`\n--- ${name}(${args.join(", ")}) ---`);
            console.log("  Encoded call:", encodedData);

            // Format output based on return types
            if (fragment.outputs.length === 1) {
                const output = fragment.outputs[0];
                let display = result.toString();

                if (output.type === "uint256" || output.type === "int256") {
                    display = result.toString();
                    // Try formatting as ether if it's a large number
                    if (BigInt(result) > 10n ** 15n) {
                        display += ` (${ethers.formatEther(result)} ETH/tokens)`;
                    }
                } else if (output.type === "bool") {
                    display = result ? "true" : "false";
                }

                console.log(`  Result (${output.type}):`, display);
            } else if (fragment.outputs.length > 1) {
                // Multiple return values
                fragment.outputs.forEach((output, i) => {
                    let display = result[i].toString();
                    if (output.type === "uint256" && BigInt(result[i]) > 10n ** 15n) {
                        display += ` (${ethers.formatEther(result[i])} ETH/tokens)`;
                    }
                    const label = output.name || `[${i}]`;
                    console.log(`  ${label} (${output.type}):`, display);
                });
            } else {
                console.log("  Result: void");
            }

        } catch (err) {
            console.log(`\n--- ${name}(${args.join(", ")}) ---`);
            console.log("  Error:", err.reason || err.message);
        }
    }

    // Batch read using multicall-style
    console.log("\n==================== BATCH READ (Promise.allSettled) ====================");
    const batchCalls = CALLS.map(({ name, args }) =>
        contract[name](...args)
            .then((result) => ({ name, args, result, status: "fulfilled" }))
            .catch((err) => ({ name, args, error: err.reason || err.message, status: "rejected" }))
    );

    const batchResults = await Promise.all(batchCalls);

    batchResults.forEach((r) => {
        if (r.status === "fulfilled") {
            console.log(`  ${r.name}(${r.args.join(", ")}):`, r.result.toString());
        } else {
            console.log(`  ${r.name}(${r.args.join(", ")}): ERROR -`, r.error);
        }
    });
}

readContract().catch((err) => {
    console.error("Error reading contract:", err.message);
    process.exit(1);
});
