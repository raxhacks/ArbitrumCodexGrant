const { ethers } = require("ethers");

const RPC_URL = "https://arb1.arbitrum.io/rpc";
const PRIVATE_KEY = "YOUR_PRIVATE_KEY_HERE";
const EXPRESS_LANE_AUCTION_ADDRESS = "0x5fcb496a31b7AE91e7c9078Ec662bd7A55cd3079";
const EXPRESS_LANE_CONTROLLER = "YOUR_EXPRESS_LANE_CONTROLLER_ADDRESS";
const BID_AMOUNT = ethers.parseEther("0.001");

const EXPRESS_LANE_AUCTION_ABI = [
    "function currentRound() external view returns (uint64)",
    "function roundDurationSeconds() external view returns (uint64)",
    "function reservePrice() external view returns (uint256)",
    "function biddingToken() external view returns (address)",
    "function placeBid(uint64 round, address expressLaneController, uint256 amount, bytes signature) external",
    "function deposit(uint256 amount) external",
];

const ERC20_ABI = [
    "function balanceOf(address account) external view returns (uint256)",
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function symbol() external view returns (string)",
    "function decimals() external view returns (uint8)",
];

async function signBid(wallet, chainId, auctionAddress, round, expressLaneController, amount) {
    const domain = {
        name: "ExpressLaneAuction",
        version: "1",
        chainId: chainId,
        verifyingContract: auctionAddress,
    };

    const types = {
        Bid: [
            { name: "round", type: "uint64" },
            { name: "expressLaneController", type: "address" },
            { name: "amount", type: "uint256" },
        ],
    };

    const value = {
        round: round,
        expressLaneController: expressLaneController,
        amount: amount,
    };

    return await wallet.signTypedData(domain, types, value);
}

async function submitTimeboostBid() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const auction = new ethers.Contract(EXPRESS_LANE_AUCTION_ADDRESS, EXPRESS_LANE_AUCTION_ABI, wallet);

    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);

    console.log("ACCOUNT INFO");
    console.log("Wallet:", wallet.address);
    console.log("Chain ID:", chainId);

    // Get current auction state
    const [currentRound, roundDuration, reservePrice, biddingTokenAddress] = await Promise.all([
        auction.currentRound(),
        auction.roundDurationSeconds(),
        auction.reservePrice(),
        auction.biddingToken(),
    ]);

    // Fetch bidding token info
    const biddingToken = new ethers.Contract(biddingTokenAddress, ERC20_ABI, wallet);
    const [symbol, decimals, balance, allowance] = await Promise.all([
        biddingToken.symbol(),
        biddingToken.decimals(),
        biddingToken.balanceOf(wallet.address),
        biddingToken.allowance(wallet.address, EXPRESS_LANE_AUCTION_ADDRESS),
    ]);

    const targetRound = BigInt(currentRound) + 1n;

    console.log("\nAUCTION STATE");
    console.log("Current round:", currentRound.toString());
    console.log("Target round:", targetRound.toString());
    console.log("Round duration:", roundDuration.toString(), "seconds");
    console.log("Reserve price:", ethers.formatUnits(reservePrice, decimals), symbol);
    console.log("Bidding token:", biddingTokenAddress, `(${symbol})`);

    // Validate bid amount against reserve price
    if (BID_AMOUNT < reservePrice) {
        console.log("\nBid amount is below reserve price!");
        console.log("Bid:", ethers.formatUnits(BID_AMOUNT, decimals), symbol);
        console.log("Reserve:", ethers.formatUnits(reservePrice, decimals), symbol);
        process.exit(1);
    }

    console.log("\nTOKEN BALANCE");
    console.log(`Balance: ${ethers.formatUnits(balance, decimals)} ${symbol}`);
    console.log(`Allowance: ${ethers.formatUnits(allowance, decimals)} ${symbol}`);

    // Approve if needed
    if (allowance < BID_AMOUNT) {
        console.log("\nApproving bidding token...");
        const approveTx = await biddingToken.approve(EXPRESS_LANE_AUCTION_ADDRESS, ethers.MaxUint256);
        await approveTx.wait();
        console.log("Approved. Tx:", approveTx.hash);
    }

    // Deposit if needed
    if (balance < BID_AMOUNT) {
        console.log("\nInsufficient token balance!");
        console.log(`Need: ${ethers.formatUnits(BID_AMOUNT, decimals)} ${symbol}`);
        console.log(`Have: ${ethers.formatUnits(balance, decimals)} ${symbol}`);
        process.exit(1);
    }

    // Sign the bid
    console.log("\nSIGNING BID");
    const signature = await signBid(
        wallet,
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
    console.log("Amount:", ethers.formatUnits(BID_AMOUNT, decimals), symbol);

    const tx = await auction.placeBid(targetRound, EXPRESS_LANE_CONTROLLER, BID_AMOUNT, signature);
    console.log("Transaction hash:", tx.hash);

    const receipt = await tx.wait();
    console.log("Status:", receipt.status === 1 ? "SUCCESS" : "REVERTED");
    console.log("Confirmed in block:", receipt.blockNumber);
    console.log("Gas used:", receipt.gasUsed.toString());
}

submitTimeboostBid().catch((err) => {
    console.error("Error submitting Timeboost bid:", err.message);
    process.exit(1);
});
