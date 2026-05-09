const { Web3 } = require("web3");

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
    {
        name: "currentRound",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint64" }],
    },
    {
        name: "roundTimingInfo",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [
            { name: "offsetTimestamp", type: "int64" },
            { name: "roundDurationSeconds", type: "uint64" },
            { name: "auctionClosingSeconds", type: "uint64" },
            { name: "reserveSubmissionSeconds", type: "uint64" },
        ],
    },
    {
        name: "reservePrice",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
    },
    {
        name: "biddingToken",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "address" }],
    },
];

const ERC20_ABI = [
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
];

async function detectTimeboost() {
    const rpcUrl = RPC_BY_CHAIN_ID[CHAIN_ID];
    if (!rpcUrl) {
        console.log(`No known RPC endpoint for chain ID ${CHAIN_ID}`);
        console.log("Timeboost status: UNKNOWN");
        process.exit(1);
    }

    const web3 = new Web3(rpcUrl);

    // Verify chain ID
    const connectedChainId = Number(await web3.eth.getChainId());
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
    const code = await web3.eth.getCode(auctionAddress);
    if (code === "0x") {
        console.log(`No contract deployed at ${auctionAddress}`);
        console.log("Timeboost status: NOT DEPLOYED");
        return;
    }

    console.log(`ExpressLaneAuction contract found at ${auctionAddress}`);

    // Try calling contract functions to verify it's active
    const auction = new web3.eth.Contract(EXPRESS_LANE_AUCTION_ABI, auctionAddress);

    try {
        const currentRound = await auction.methods.currentRound().call();
        const timing = await auction.methods.roundTimingInfo().call();
        const roundDuration = timing.roundDurationSeconds ?? timing[1];
        const reservePrice = await auction.methods.reservePrice().call();
        const biddingTokenAddress = await auction.methods.biddingToken().call();

        const biddingToken = new web3.eth.Contract(ERC20_ABI, biddingTokenAddress);
        const symbol = await biddingToken.methods.symbol().call();
        const decimals = Number(await biddingToken.methods.decimals().call());

        const fmtToken = (val) => {
            const str = val.toString().padStart(decimals + 1, "0");
            const whole = str.slice(0, str.length - decimals) || "0";
            const frac = str.slice(str.length - decimals).replace(/0+$/, "");
            return frac ? `${whole}.${frac}` : whole;
        };

        const isActive = Number(currentRound) > 0 || Number(roundDuration) > 0;

        console.log("Current round:", currentRound.toString());
        console.log("Round duration:", roundDuration.toString(), "seconds");
        console.log("Bidding token:", biddingTokenAddress, `(${symbol})`);
        console.log("Reserve price:", fmtToken(reservePrice), symbol);
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
