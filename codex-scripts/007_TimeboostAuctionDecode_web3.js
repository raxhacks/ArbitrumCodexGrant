const { Web3 } = require("web3");

const RPC_URL = "https://arb1.arbitrum.io/rpc";
const EXPRESS_LANE_AUCTION_ADDRESS = "0x5fcb496a31b7AE91e7c9078Ec662bd7A55cd3079";
const TX_HASH = process.env.TX_HASH || "0xb19e7f3ae8a72fadc2f95e8d28957a861496590a86c8e5b0a2d939885b6bbdea";

const EXPRESS_LANE_AUCTION_ABI = [
    {
        name: "placeBid",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "round", type: "uint64" },
            { name: "expressLaneController", type: "address" },
            { name: "amount", type: "uint256" },
            { name: "signature", type: "bytes" },
        ],
        outputs: [],
    },
    {
        name: "deposit",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [{ name: "amount", type: "uint256" }],
        outputs: [],
    },
    {
        name: "initiateWithdrawal",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [],
        outputs: [],
    },
    {
        name: "finalizeWithdrawal",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [],
        outputs: [],
    },
    {
        name: "resolveAuction",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "round", type: "uint64" },
            { name: "firstPriceBidder", type: "address" },
            { name: "firstPriceExpressLaneController", type: "address" },
            { name: "firstPriceAmount", type: "uint256" },
            { name: "firstPriceSignature", type: "bytes" },
            { name: "secondPriceBidder", type: "address" },
            { name: "secondPriceExpressLaneController", type: "address" },
            { name: "secondPriceAmount", type: "uint256" },
            { name: "secondPriceSignature", type: "bytes" },
        ],
        outputs: [],
    },
    {
        name: "resolveSingleBidAuction",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "round", type: "uint64" },
            { name: "bidder", type: "address" },
            { name: "expressLaneController", type: "address" },
            { name: "amount", type: "uint256" },
            { name: "signature", type: "bytes" },
        ],
        outputs: [],
    },
    {
        name: "setReservePrice",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [{ name: "newReservePrice", type: "uint256" }],
        outputs: [],
    },
    {
        name: "setMinReservePrice",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [{ name: "newMinReservePrice", type: "uint256" }],
        outputs: [],
    },
    {
        name: "setBeneficiary",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [{ name: "newBeneficiary", type: "address" }],
        outputs: [],
    },
    {
        name: "setRoundTimingInfo",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "currentRound", type: "uint64" },
            { name: "offsetTimestamp", type: "int64" },
            { name: "roundDurationSeconds", type: "uint64" },
            { name: "auctionClosingSeconds", type: "uint64" },
        ],
        outputs: [],
    },
    {
        name: "transferExpressLaneController",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "round", type: "uint64" },
            { name: "newExpressLaneController", type: "address" },
        ],
        outputs: [],
    },
    {
        name: "AuctionResolved",
        type: "event",
        inputs: [
            { name: "round", type: "uint64", indexed: true },
            { name: "firstPriceBidder", type: "address", indexed: true },
            { name: "expressLaneController", type: "address", indexed: true },
            { name: "price", type: "uint256", indexed: false },
        ],
    },
    {
        name: "SetReservePrice",
        type: "event",
        inputs: [
            { name: "oldReservePrice", type: "uint256", indexed: false },
            { name: "newReservePrice", type: "uint256", indexed: false },
        ],
    },
    {
        name: "SetMinReservePrice",
        type: "event",
        inputs: [
            { name: "oldPrice", type: "uint256", indexed: false },
            { name: "newPrice", type: "uint256", indexed: false },
        ],
    },
    {
        name: "SetBeneficiary",
        type: "event",
        inputs: [
            { name: "oldBeneficiary", type: "address", indexed: false },
            { name: "newBeneficiary", type: "address", indexed: false },
        ],
    },
    {
        name: "Deposit",
        type: "event",
        inputs: [
            { name: "sender", type: "address", indexed: true },
            { name: "amount", type: "uint256", indexed: false },
        ],
    },
    {
        name: "WithdrawalInitiated",
        type: "event",
        inputs: [
            { name: "sender", type: "address", indexed: true },
            { name: "amount", type: "uint256", indexed: false },
        ],
    },
    {
        name: "WithdrawalFinalized",
        type: "event",
        inputs: [
            { name: "sender", type: "address", indexed: true },
            { name: "amount", type: "uint256", indexed: false },
        ],
    },
    {
        name: "ExpressLaneControllerTransferred",
        type: "event",
        inputs: [
            { name: "round", type: "uint64", indexed: true },
            { name: "from", type: "address", indexed: true },
            { name: "to", type: "address", indexed: true },
        ],
    },
    {
        name: "SetRoundTimingInfo",
        type: "event",
        inputs: [
            { name: "currentRound", type: "uint64", indexed: false },
            { name: "offsetTimestamp", type: "int64", indexed: false },
            { name: "roundDurationSeconds", type: "uint64", indexed: false },
            { name: "auctionClosingSeconds", type: "uint64", indexed: false },
        ],
    },
];

async function decodeTimeboostTx() {
    const web3 = new Web3(RPC_URL);
    const auction = new web3.eth.Contract(EXPRESS_LANE_AUCTION_ABI, EXPRESS_LANE_AUCTION_ADDRESS);

    // Fetch the transaction
    const tx = await web3.eth.getTransaction(TX_HASH);
    if (!tx) {
        console.log("Transaction not found:", TX_HASH);
        process.exit(1);
    }

    console.log("TRANSACTION INFO");
    console.log("Hash:", tx.hash);
    console.log("From:", tx.from);
    console.log("To:", tx.to);
    console.log("Value:", Web3.utils.fromWei(tx.value, "ether"), "ETH");
    console.log("Block:", tx.blockNumber.toString());
    console.log("Gas limit:", tx.gas.toString());

    // Decode function call
    console.log("\nDECODED FUNCTION CALL");

    // Get function selector (first 4 bytes)
    const selector = tx.input.slice(0, 10);

    // Find matching function in ABI
    const functionAbis = EXPRESS_LANE_AUCTION_ABI.filter((item) => item.type === "function");
    let decodedFunction = null;

    for (const funcAbi of functionAbis) {
        const sig = web3.eth.abi.encodeFunctionSignature(funcAbi);
        if (sig === selector) {
            decodedFunction = funcAbi;
            break;
        }
    }

    if (decodedFunction) {
        console.log("Function:", decodedFunction.name);

        const params = web3.eth.abi.decodeParameters(decodedFunction.inputs, "0x" + tx.input.slice(10));
        console.log("\nParameters:");
        decodedFunction.inputs.forEach((input) => {
            let displayValue = params[input.name].toString();

            if (input.type === "uint256") {
                displayValue = `${params[input.name].toString()} (${Web3.utils.fromWei(params[input.name], "ether")} if 18 decimals)`;
            } else if (input.type === "bytes") {
                const val = params[input.name];
                displayValue = val.length > 66
                    ? `${val.substring(0, 66)}... (${(val.length - 2) / 2} bytes)`
                    : val;
            }

            console.log(`  ${input.name} (${input.type}): ${displayValue}`);
        });
    } else {
        console.log("Could not decode function call");
        console.log("Selector:", selector);
        console.log("Raw data:", tx.input);
    }

    // Fetch receipt and decode logs
    const receipt = await web3.eth.getTransactionReceipt(TX_HASH);
    if (!receipt) {
        console.log("\nTransaction receipt not found (pending?)");
        return;
    }

    console.log("\nTRANSACTION RESULT");
    console.log("Status:", receipt.status ? "SUCCESS" : "REVERTED");
    console.log("Gas used:", receipt.gasUsed.toString());
    console.log("Effective gas price:", Web3.utils.fromWei(receipt.effectiveGasPrice, "gwei"), "gwei");

    console.log("\nDECODED EVENTS");
    console.log("Total logs:", receipt.logs.length);

    const eventAbis = EXPRESS_LANE_AUCTION_ABI.filter((item) => item.type === "event");

    receipt.logs.forEach((log, index) => {
        let decoded = false;

        for (const eventAbi of eventAbis) {
            const eventSig = web3.eth.abi.encodeEventSignature(eventAbi);
            if (log.topics[0] === eventSig) {
                const indexedInputs = eventAbi.inputs.filter((i) => i.indexed);
                const nonIndexedInputs = eventAbi.inputs.filter((i) => !i.indexed);

                console.log(`\n--- Event ${index + 1}: ${eventAbi.name} ---`);

                // Decode indexed params from topics
                indexedInputs.forEach((input, i) => {
                    const raw = log.topics[i + 1];
                    let value;
                    if (input.type === "address") {
                        value = "0x" + raw.slice(26);
                    } else {
                        value = web3.eth.abi.decodeParameter(input.type, raw);
                    }
                    console.log(`  ${input.name} (${input.type}): ${value}`);
                });

                // Decode non-indexed params from data
                if (nonIndexedInputs.length > 0 && log.data !== "0x") {
                    const decodedData = web3.eth.abi.decodeParameters(nonIndexedInputs, log.data);
                    nonIndexedInputs.forEach((input) => {
                        let displayValue = decodedData[input.name].toString();
                        if (input.type === "uint256") {
                            displayValue = `${decodedData[input.name].toString()} (${Web3.utils.fromWei(decodedData[input.name], "ether")} if 18 decimals)`;
                        }
                        console.log(`  ${input.name} (${input.type}): ${displayValue}`);
                    });
                }

                decoded = true;
                break;
            }
        }

        if (!decoded) {
            console.log(`\n--- Event ${index + 1}: UNKNOWN ---`);
            console.log("  Address:", log.address);
            console.log("  Topics:", log.topics);
            console.log("  Data:", log.data);
        }
    });
}

decodeTimeboostTx().catch((err) => {
    console.error("Error decoding transaction:", err.message);
    process.exit(1);
});
