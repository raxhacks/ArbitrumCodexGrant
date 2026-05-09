const { Web3 } = require("web3");
const { secp256k1 } = require("ethereum-cryptography/secp256k1");

const RPC_URL = "https://arb1.arbitrum.io/rpc";
const PRIVATE_KEY = "YOUR_PRIVATE_KEY_HERE";
const EXPRESS_LANE_AUCTION_ADDRESS = "0x5fcb496a31b7AE91e7c9078Ec662bd7A55cd3079";
const EXPRESS_LANE_CONTROLLER = "YOUR_EXPRESS_LANE_CONTROLLER_ADDRESS";
const BID_AMOUNT = Web3.utils.toWei("0.001", "ether");

const EXPRESS_LANE_AUCTION_ABI = [
    {
        name: "currentRound",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint64" }],
    },
    {
        name: "roundDurationSeconds",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint64" }],
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
];

const ERC20_ABI = [
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
        name: "approve",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "spender", type: "address" },
            { name: "amount", type: "uint256" },
        ],
        outputs: [{ name: "", type: "bool" }],
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
];

function signBid(web3, privateKey, chainId, auctionAddress, round, expressLaneController, amount) {
    // Build EIP-712 domain separator
    const domainTypeHash = web3.utils.keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );
    const domainSeparator = web3.utils.keccak256(
        web3.eth.abi.encodeParameters(
            ["bytes32", "bytes32", "bytes32", "uint256", "address"],
            [
                domainTypeHash,
                web3.utils.keccak256("ExpressLaneAuction"),
                web3.utils.keccak256("1"),
                chainId,
                auctionAddress,
            ]
        )
    );

    // Build struct hash
    const bidTypeHash = web3.utils.keccak256(
        "Bid(uint64 round,address expressLaneController,uint256 amount)"
    );
    const structHash = web3.utils.keccak256(
        web3.eth.abi.encodeParameters(
            ["bytes32", "uint64", "address", "uint256"],
            [bidTypeHash, round.toString(), expressLaneController, amount.toString()]
        )
    );

    // EIP-712 hash
    const digest = web3.utils.keccak256(
        "0x1901" + domainSeparator.slice(2) + structHash.slice(2)
    );

    // Sign with raw ECDSA (no Ethereum message prefix)
    const ecSig = secp256k1.sign(digest.slice(2), privateKey.slice(2));
    const r = "0x" + ecSig.r.toString(16).padStart(64, "0");
    const s = "0x" + ecSig.s.toString(16).padStart(64, "0");
    const v = "0x" + (ecSig.recovery + 27).toString(16).padStart(2, "0");
    return r + s.slice(2) + v.slice(2);
}

async function submitTimeboostBid() {
    const web3 = new Web3(RPC_URL);
    const account = web3.eth.accounts.privateKeyToAccount(PRIVATE_KEY);
    web3.eth.accounts.wallet.add(account);
    const auction = new web3.eth.Contract(EXPRESS_LANE_AUCTION_ABI, EXPRESS_LANE_AUCTION_ADDRESS);

    const chainId = Number(await web3.eth.getChainId());

    console.log("ACCOUNT INFO");
    console.log("Wallet:", account.address);
    console.log("Chain ID:", chainId);

    // Get current auction state
    const currentRound = await auction.methods.currentRound().call();
    const roundDuration = await auction.methods.roundDurationSeconds().call();
    const reservePrice = await auction.methods.reservePrice().call();
    const biddingTokenAddress = await auction.methods.biddingToken().call();

    const targetRound = BigInt(currentRound) + 1n;

    console.log("\nAUCTION STATE");
    console.log("Current round:", currentRound.toString());
    console.log("Target round:", targetRound.toString());
    console.log("Round duration:", roundDuration.toString(), "seconds");
    console.log("Bidding token:", biddingTokenAddress);

    // Check bidding token balance and allowance
    const biddingToken = new web3.eth.Contract(ERC20_ABI, biddingTokenAddress);
    const symbol = await biddingToken.methods.symbol().call();
    const decimals = Number(await biddingToken.methods.decimals().call());

    const fmtToken = (val) => {
        const str = val.toString().padStart(decimals + 1, "0");
        const whole = str.slice(0, str.length - decimals) || "0";
        const frac = str.slice(str.length - decimals).replace(/0+$/, "");
        return frac ? `${whole}.${frac}` : whole;
    };

    console.log("Reserve price:", fmtToken(reservePrice), symbol);

    // Validate bid amount against reserve price
    if (BigInt(BID_AMOUNT) < BigInt(reservePrice)) {
        console.log("\nBid amount is below reserve price!");
        console.log("Bid:", fmtToken(BID_AMOUNT), symbol);
        console.log("Reserve:", fmtToken(reservePrice), symbol);
        process.exit(1);
    }

    const balance = await biddingToken.methods.balanceOf(account.address).call();
    const allowance = await biddingToken.methods.allowance(account.address, EXPRESS_LANE_AUCTION_ADDRESS).call();

    console.log("\nTOKEN BALANCE");
    console.log(`Balance: ${fmtToken(balance)} ${symbol}`);
    console.log(`Allowance: ${fmtToken(allowance)} ${symbol}`);

    // Approve if needed
    if (BigInt(allowance) < BigInt(BID_AMOUNT)) {
        console.log("\nApproving bidding token...");
        const maxUint256 = "0x" + "f".repeat(64);
        const approveTx = await biddingToken.methods.approve(EXPRESS_LANE_AUCTION_ADDRESS, maxUint256).send({
            from: account.address,
        });
        console.log("Approved. Tx:", approveTx.transactionHash);
    }

    // Deposit if needed
    if (BigInt(balance) < BigInt(BID_AMOUNT)) {
        console.log("\nInsufficient token balance!");
        console.log(`Need: ${fmtToken(BID_AMOUNT)} ${symbol}`);
        console.log(`Have: ${fmtToken(balance)} ${symbol}`);
        process.exit(1);
    }

    // Sign the bid
    console.log("\nSIGNING BID");
    const signature = signBid(
        web3,
        PRIVATE_KEY,
        chainId,
        EXPRESS_LANE_AUCTION_ADDRESS,
        targetRound,
        EXPRESS_LANE_CONTROLLER,
        BID_AMOUNT
    );
    console.log("Signature:", signature);

    // Submit the bid
    console.log("\nSUBMITTING BID");
    console.log("Round:", targetRound.toString());
    console.log("Express lane controller:", EXPRESS_LANE_CONTROLLER);
    console.log("Amount:", fmtToken(BID_AMOUNT), symbol);

    const tx = await auction.methods
        .placeBid(targetRound, EXPRESS_LANE_CONTROLLER, BID_AMOUNT, signature)
        .send({ from: account.address });

    console.log("Transaction hash:", tx.transactionHash);
    console.log("Status:", tx.status ? "SUCCESS" : "REVERTED");
    console.log("Confirmed in block:", tx.blockNumber.toString());
    console.log("Gas used:", tx.gasUsed.toString());
}

submitTimeboostBid().catch((err) => {
    console.error("Error submitting Timeboost bid:", err.message);
    process.exit(1);
});
