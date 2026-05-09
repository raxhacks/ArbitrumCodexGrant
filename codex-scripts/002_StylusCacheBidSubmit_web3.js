const { Web3 } = require("web3");

const RPC_URL = "https://arb1.arbitrum.io/rpc";
const PRIVATE_KEY = "YOUR_PRIVATE_KEY_HERE";
const CACHE_MANAGER_ADDRESS = "0x51dEDBD2f190E0696AFbEE5E60bFdE96d86464ec";
const PROGRAM_ADDRESS = "YOUR_STYLUS_PROGRAM_ADDRESS_HERE";
const BID_AMOUNT = Web3.utils.toWei("0.001", "ether");

const CACHE_MANAGER_ABI = [
    {
        name: "placeBid",
        type: "function",
        stateMutability: "payable",
        inputs: [{ name: "program", type: "address" }],
        outputs: [],
    },
    {
        name: "getMinBid",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "program", type: "address" }],
        outputs: [{ name: "", type: "uint256" }],
    },
    {
        name: "isProgramCached",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "program", type: "address" }],
        outputs: [{ name: "", type: "bool" }],
    },
];

async function submitCacheBid() {
    const web3 = new Web3(RPC_URL);
    const account = web3.eth.accounts.privateKeyToAccount(PRIVATE_KEY);
    web3.eth.accounts.wallet.add(account);
    const cacheManager = new web3.eth.Contract(CACHE_MANAGER_ABI, CACHE_MANAGER_ADDRESS);

    console.log("Wallet:", account.address);
    console.log("Program:", PROGRAM_ADDRESS);

    // Check if already cached
    const isCached = await cacheManager.methods.isProgramCached(PROGRAM_ADDRESS).call();
    if (isCached) {
        console.log("Program is already cached. No bid needed.");
        return;
    }

    // Get minimum bid
    const minBid = await cacheManager.methods.getMinBid(PROGRAM_ADDRESS).call();
    console.log("Minimum bid:", Web3.utils.fromWei(minBid, "ether"), "ETH");

    // Ensure bid meets minimum
    const finalBid = BigInt(BID_AMOUNT) > BigInt(minBid) ? BID_AMOUNT : minBid;
    console.log("Submitting bid:", Web3.utils.fromWei(finalBid, "ether"), "ETH");

    // Submit the bid
    const tx = await cacheManager.methods.placeBid(PROGRAM_ADDRESS).send({
        from: account.address,
        value: finalBid,
    });
    console.log("Transaction hash:", tx.transactionHash);
    console.log("Confirmed in block:", tx.blockNumber.toString());
    console.log("Gas used:", tx.gasUsed.toString());

    // Verify cache status
    const cachedAfter = await cacheManager.methods.isProgramCached(PROGRAM_ADDRESS).call();
    console.log("Program cached:", cachedAfter);
}

submitCacheBid().catch((err) => {
    console.error("Error submitting cache bid:", err.message);
    process.exit(1);
});
