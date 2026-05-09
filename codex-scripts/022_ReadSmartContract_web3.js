const { Web3 } = require("web3");

const RPC_URL = "https://arb1.arbitrum.io/rpc";
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "0x912CE59144191C1204E64559FE8253a0e49E6548";

// Replace with your contract's ABI (view/pure functions you want to read)
const CONTRACT_ABI = [
    {
        name: "name",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "string" }],
    },
    {
        name: "symbol",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "string" }],
    },
    {
        name: "decimals",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint8" }],
    },
    {
        name: "totalSupply",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
    },
    {
        name: "balanceOf",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "account", type: "address" }],
        outputs: [{ name: "", type: "uint256" }],
    },
    {
        name: "allowance",
        type: "function",
        stateMutability: "view",
        inputs: [
            { name: "owner", type: "address" },
            { name: "spender", type: "address" },
        ],
        outputs: [{ name: "", type: "uint256" }],
    },
    {
        name: "owner",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "address" }],
    },
    {
        name: "paused",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "bool" }],
    },
    {
        name: "get",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
    },
];

const CALLS = [
    { name: "name", args: [] },
    { name: "symbol", args: [] },
    { name: "decimals", args: [] },
    { name: "totalSupply", args: [] },
    { name: "owner", args: [] },
    // { name: "balanceOf", args: ["0xYourAddressHere"] },
    // { name: "allowance", args: ["0xOwner", "0xSpender"] },
];

async function readContract() {
    const web3 = new Web3(RPC_URL);

    // Verify contract exists
    const code = await web3.eth.getCode(CONTRACT_ADDRESS);
    if (code === "0x") {
        console.log("No contract at:", CONTRACT_ADDRESS);
        process.exit(1);
    }

    const contract = new web3.eth.Contract(CONTRACT_ABI, CONTRACT_ADDRESS);

    console.log("CONTRACT");
    console.log("Address:", CONTRACT_ADDRESS);
    console.log("Bytecode size:", (code.length - 2) / 2, "bytes");

    // List available view functions
    console.log("\nAVAILABLE FUNCTIONS");
    const viewFunctions = CONTRACT_ABI.filter(
        (item) => item.type === "function" && (item.stateMutability === "view" || item.stateMutability === "pure")
    );

    viewFunctions.forEach((func) => {
        const inputs = func.inputs.map((i) => `${i.type} ${i.name}`).join(", ");
        const outputs = func.outputs.map((o) => `${o.type} ${o.name || ""}`).join(", ");
        console.log(`  ${func.name}(${inputs}) -> (${outputs})`);
    });

    // Execute calls
    console.log("\nRESULTS");

    for (const call of CALLS) {
        const { name, args } = call;

        try {
            const funcAbi = CONTRACT_ABI.find((item) => item.type === "function" && item.name === name);
            const txMethod = contract.methods[name](...args);
            const encodedData = txMethod.encodeABI();

            const result = await txMethod.call();

            console.log(`\n--- ${name}(${args.join(", ")}) ---`);
            console.log("  Encoded call:", encodedData);

            // Format output
            if (funcAbi.outputs.length === 1) {
                const output = funcAbi.outputs[0];
                let display = result.toString();

                if (output.type === "uint256" || output.type === "int256") {
                    display = result.toString();
                    if (BigInt(result) > 10n ** 15n) {
                        display += ` (${Web3.utils.fromWei(result.toString(), "ether")} ETH/tokens)`;
                    }
                } else if (output.type === "bool") {
                    display = result ? "true" : "false";
                }

                console.log(`  Result (${output.type}):`, display);
            } else if (funcAbi.outputs.length > 1) {
                funcAbi.outputs.forEach((output, i) => {
                    let display = result[i].toString();
                    if (output.type === "uint256" && BigInt(result[i]) > 10n ** 15n) {
                        display += ` (${Web3.utils.fromWei(result[i].toString(), "ether")} ETH/tokens)`;
                    }
                    const label = output.name || `[${i}]`;
                    console.log(`  ${label} (${output.type}):`, display);
                });
            } else {
                console.log("  Result: void");
            }

        } catch (err) {
            console.log(`\n--- ${name}(${args.join(", ")}) ---`);
            console.log("  Error:", err.message);
        }
    }

    // Batch read
    console.log("\nBATCH READ (Promise.allSettled)");
    const batchCalls = CALLS.map(({ name, args }) =>
        contract.methods[name](...args).call()
            .then((result) => ({ name, args, result, status: "fulfilled" }))
            .catch((err) => ({ name, args, error: err.message, status: "rejected" }))
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
