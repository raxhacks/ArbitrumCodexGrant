const { ethers } = require("ethers");

const RPC_URL = "https://arb1.arbitrum.io/rpc";
const PRIVATE_KEY_OWNER = process.env.PRIVATE_KEY_OWNER || ethers.Wallet.createRandom().privateKey;
const PRIVATE_KEY_SPENDER = process.env.PRIVATE_KEY_SPENDER || ethers.Wallet.createRandom().privateKey;
const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS || "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1";
const RECIPIENT = process.env.RECIPIENT || ethers.Wallet.createRandom().address;
const TRANSFER_AMOUNT = ethers.parseEther("1.0");
const DRY_RUN = process.env.DRY_RUN !== "false";

const ERC20_PERMIT_ABI = [
    "function name() external view returns (string)",
    "function symbol() external view returns (string)",
    "function decimals() external view returns (uint8)",
    "function totalSupply() external view returns (uint256)",
    "function balanceOf(address account) external view returns (uint256)",
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function nonces(address owner) external view returns (uint256)",
    "function DOMAIN_SEPARATOR() external view returns (bytes32)",
    "function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external",
    "function transferFrom(address from, address to, uint256 amount) external returns (bool)",
    "function transfer(address to, uint256 amount) external returns (bool)",
];

async function permitTransfer() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const owner = new ethers.Wallet(PRIVATE_KEY_OWNER, provider);
    const spender = new ethers.Wallet(PRIVATE_KEY_SPENDER, provider);
    const token = new ethers.Contract(TOKEN_ADDRESS, ERC20_PERMIT_ABI, provider);

    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);

    // Token info
    const name = await token.name();
    const symbol = await token.symbol();
    const decimals = await token.decimals();

    console.log("TOKEN INFO");
    console.log("Name:", name);
    console.log("Symbol:", symbol);
    console.log("Decimals:", decimals.toString());
    console.log("Address:", TOKEN_ADDRESS);
    console.log("Chain ID:", chainId);

    console.log("\nACCOUNTS");
    console.log("Owner:", owner.address);
    console.log("Spender:", spender.address);
    console.log("Recipient:", RECIPIENT);

    // Balances
    const ownerBalance = await token.balanceOf(owner.address);
    const recipientBalance = await token.balanceOf(RECIPIENT);
    console.log("\nOwner balance:", ethers.formatUnits(ownerBalance, decimals), symbol);
    console.log("Recipient balance:", ethers.formatUnits(recipientBalance, decimals), symbol);

    // Check sufficient balance (only enforced when actually broadcasting)
    if (ownerBalance < TRANSFER_AMOUNT && !DRY_RUN) {
        console.log("\nInsufficient owner balance!");
        console.log("Need:", ethers.formatUnits(TRANSFER_AMOUNT, decimals), symbol);
        process.exit(1);
    }

    // Get nonce for permit
    const nonce = await token.nonces(owner.address);
    const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour

    console.log("\nPERMIT PARAMS");
    console.log("Amount:", ethers.formatUnits(TRANSFER_AMOUNT, decimals), symbol);
    console.log("Nonce:", nonce.toString());
    console.log("Deadline:", new Date(deadline * 1000).toISOString());

    // EIP-2612 permit signature
    const domain = {
        name: name,
        version: "1",
        chainId: chainId,
        verifyingContract: TOKEN_ADDRESS,
    };

    const types = {
        Permit: [
            { name: "owner", type: "address" },
            { name: "spender", type: "address" },
            { name: "value", type: "uint256" },
            { name: "nonce", type: "uint256" },
            { name: "deadline", type: "uint256" },
        ],
    };

    const message = {
        owner: owner.address,
        spender: spender.address,
        value: TRANSFER_AMOUNT,
        nonce: nonce,
        deadline: deadline,
    };

    // Sign permit
    console.log("\nSIGNING PERMIT");
    const signature = await owner.signTypedData(domain, types, message);
    const sig = ethers.Signature.from(signature);

    console.log("Signature:", signature);
    console.log("v:", sig.v);
    console.log("r:", sig.r);
    console.log("s:", sig.s);

    // Verify signature
    const recovered = ethers.verifyTypedData(domain, types, message, signature);
    console.log("Recovered signer:", recovered);
    console.log("Valid:", recovered.toLowerCase() === owner.address.toLowerCase());

    if (DRY_RUN) return;

    // Submit permit tx (spender calls permit)
    console.log("\nSUBMITTING PERMIT");
    const tokenAsSpender = new ethers.Contract(TOKEN_ADDRESS, ERC20_PERMIT_ABI, spender);
    const permitTx = await tokenAsSpender.permit(
        owner.address,
        spender.address,
        TRANSFER_AMOUNT,
        deadline,
        sig.v,
        sig.r,
        sig.s
    );
    console.log("Permit tx hash:", permitTx.hash);

    const permitReceipt = await permitTx.wait();
    console.log("Permit status:", permitReceipt.status === 1 ? "SUCCESS" : "REVERTED");
    console.log("Gas used:", permitReceipt.gasUsed.toString());

    // Check allowance
    const allowance = await token.allowance(owner.address, spender.address);
    console.log("Allowance set:", ethers.formatUnits(allowance, decimals), symbol);

    // Execute transferFrom (spender transfers from owner to recipient)
    console.log("\nEXECUTING TRANSFER");
    const transferTx = await tokenAsSpender.transferFrom(owner.address, RECIPIENT, TRANSFER_AMOUNT);
    console.log("Transfer tx hash:", transferTx.hash);

    const transferReceipt = await transferTx.wait();
    console.log("Transfer status:", transferReceipt.status === 1 ? "SUCCESS" : "REVERTED");
    console.log("Gas used:", transferReceipt.gasUsed.toString());

    // Final balances
    console.log("\nFINAL BALANCES");
    const ownerBalanceAfter = await token.balanceOf(owner.address);
    const recipientBalanceAfter = await token.balanceOf(RECIPIENT);
    console.log("Owner balance:", ethers.formatUnits(ownerBalanceAfter, decimals), symbol);
    console.log("Recipient balance:", ethers.formatUnits(recipientBalanceAfter, decimals), symbol);
}

permitTransfer().catch((err) => {
    console.error("Error in permit transfer:", err.message);
    process.exit(1);
});
