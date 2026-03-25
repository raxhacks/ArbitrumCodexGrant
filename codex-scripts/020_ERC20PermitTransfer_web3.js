const { Web3 } = require("web3");
const { secp256k1 } = require("ethereum-cryptography/secp256k1");

// ==================== CONFIGURATION ====================
const RPC_URL = "https://arb1.arbitrum.io/rpc";
const PRIVATE_KEY_OWNER = "YOUR_OWNER_PRIVATE_KEY_HERE";
const PRIVATE_KEY_SPENDER = "YOUR_SPENDER_PRIVATE_KEY_HERE";
const TOKEN_ADDRESS = "YOUR_ERC20_TOKEN_ADDRESS_HERE";
const RECIPIENT = "YOUR_RECIPIENT_ADDRESS_HERE";
const TRANSFER_AMOUNT = "1000000000000000000"; // 1 token in smallest unit (adjust for token decimals)

// ==================== ABI ====================
const ERC20_PERMIT_ABI = [
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
        name: "nonces",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "owner", type: "address" }],
        outputs: [{ name: "", type: "uint256" }],
    },
    {
        name: "DOMAIN_SEPARATOR",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "bytes32" }],
    },
    {
        name: "permit",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "owner", type: "address" },
            { name: "spender", type: "address" },
            { name: "value", type: "uint256" },
            { name: "deadline", type: "uint256" },
            { name: "v", type: "uint8" },
            { name: "r", type: "bytes32" },
            { name: "s", type: "bytes32" },
        ],
        outputs: [],
    },
    {
        name: "transferFrom",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "from", type: "address" },
            { name: "to", type: "address" },
            { name: "amount", type: "uint256" },
        ],
        outputs: [{ name: "", type: "bool" }],
    },
];

// ==================== HELPERS ====================
function hashType(web3, typeName, fields) {
    const encoded = `${typeName}(${fields.map((f) => `${f.type} ${f.name}`).join(",")})`;
    return web3.utils.keccak256(encoded);
}

function hashStruct(web3, typeHash, values) {
    const encoded = web3.eth.abi.encodeParameters(
        ["bytes32", ...values.map((v) => v.type)],
        [typeHash, ...values.map((v) => v.value)]
    );
    return web3.utils.keccak256(encoded);
}

// ==================== MAIN ====================
async function permitTransfer() {
    const web3 = new Web3(RPC_URL);
    const ownerAccount = web3.eth.accounts.privateKeyToAccount(PRIVATE_KEY_OWNER);
    const spenderAccount = web3.eth.accounts.privateKeyToAccount(PRIVATE_KEY_SPENDER);
    web3.eth.accounts.wallet.add(ownerAccount);
    web3.eth.accounts.wallet.add(spenderAccount);
    const token = new web3.eth.Contract(ERC20_PERMIT_ABI, TOKEN_ADDRESS);

    const chainId = Number(await web3.eth.getChainId());

    // Token info
    const name = await token.methods.name().call();
    const symbol = await token.methods.symbol().call();
    const decimals = Number(await token.methods.decimals().call());

    const fmt = (val) => {
        const str = val.toString().padStart(decimals + 1, "0");
        const whole = str.slice(0, str.length - decimals) || "0";
        const frac = str.slice(str.length - decimals).replace(/0+$/, "");
        return frac ? `${whole}.${frac}` : whole;
    };

    console.log("==================== TOKEN INFO ====================");
    console.log("Name:", name);
    console.log("Symbol:", symbol);
    console.log("Decimals:", decimals);
    console.log("Address:", TOKEN_ADDRESS);
    console.log("Chain ID:", chainId);

    console.log("\n==================== ACCOUNTS ====================");
    console.log("Owner:", ownerAccount.address);
    console.log("Spender:", spenderAccount.address);
    console.log("Recipient:", RECIPIENT);

    // Balances
    const ownerBalance = await token.methods.balanceOf(ownerAccount.address).call();
    const recipientBalance = await token.methods.balanceOf(RECIPIENT).call();
    console.log("\nOwner balance:", fmt(ownerBalance), symbol);
    console.log("Recipient balance:", fmt(recipientBalance), symbol);

    if (BigInt(ownerBalance) < BigInt(TRANSFER_AMOUNT)) {
        console.log("\nInsufficient owner balance!");
        console.log("Need:", fmt(TRANSFER_AMOUNT), symbol);
        process.exit(1);
    }

    // Get nonce for permit
    const nonce = await token.methods.nonces(ownerAccount.address).call();
    const deadline = Math.floor(Date.now() / 1000) + 3600;

    console.log("\n==================== PERMIT PARAMS ====================");
    console.log("Amount:", fmt(TRANSFER_AMOUNT), symbol);
    console.log("Nonce:", nonce.toString());
    console.log("Deadline:", new Date(deadline * 1000).toISOString());

    // Build EIP-712 domain separator
    const domainTypeHash = hashType(web3, "EIP712Domain", [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "verifyingContract", type: "address" },
    ]);

    const domainSeparator = web3.utils.keccak256(
        web3.eth.abi.encodeParameters(
            ["bytes32", "bytes32", "bytes32", "uint256", "address"],
            [
                domainTypeHash,
                web3.utils.keccak256(name),
                web3.utils.keccak256("1"),
                chainId,
                TOKEN_ADDRESS,
            ]
        )
    );

    // Build permit struct hash
    const permitTypeHash = hashType(web3, "Permit", [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
    ]);

    const structHash = hashStruct(web3, permitTypeHash, [
        { type: "address", value: ownerAccount.address },
        { type: "address", value: spenderAccount.address },
        { type: "uint256", value: TRANSFER_AMOUNT },
        { type: "uint256", value: nonce.toString() },
        { type: "uint256", value: deadline.toString() },
    ]);

    // EIP-712 hash
    const digest = web3.utils.keccak256(
        "0x1901" + domainSeparator.replace("0x", "") + structHash.replace("0x", "")
    );

    // Sign using raw ECDSA (no Ethereum message prefix for EIP-712)
    console.log("\n==================== SIGNING PERMIT ====================");
    const ecSig = secp256k1.sign(digest.slice(2), PRIVATE_KEY_OWNER.slice(2));
    const r = "0x" + ecSig.r.toString(16).padStart(64, "0");
    const s = "0x" + ecSig.s.toString(16).padStart(64, "0");
    const v = "0x" + (ecSig.recovery + 27).toString(16).padStart(2, "0");
    const signature = r + s.slice(2) + v.slice(2);
    console.log("Signature:", signature);
    console.log("v:", v);
    console.log("r:", r);
    console.log("s:", s);

    // Verify using ecrecover without message prefix
    const recovered = web3.eth.accounts.recover(digest, v, r, s, true);
    console.log("Recovered signer:", recovered);
    console.log("Valid:", recovered.toLowerCase() === ownerAccount.address.toLowerCase());

    // Parse v as uint8
    const vInt = ecSig.recovery + 27;

    // Submit permit tx (spender calls permit)
    console.log("\n==================== SUBMITTING PERMIT ====================");
    const permitTx = await token.methods.permit(
        ownerAccount.address,
        spenderAccount.address,
        TRANSFER_AMOUNT,
        deadline,
        vInt,
        r,
        s
    ).send({ from: spenderAccount.address });

    console.log("Permit tx hash:", permitTx.transactionHash);
    console.log("Permit status:", permitTx.status ? "SUCCESS" : "REVERTED");
    console.log("Gas used:", permitTx.gasUsed.toString());

    // Check allowance
    const allowance = await token.methods.allowance(ownerAccount.address, spenderAccount.address).call();
    console.log("Allowance set:", fmt(allowance), symbol);

    // Execute transferFrom
    console.log("\n==================== EXECUTING TRANSFER ====================");
    const transferTx = await token.methods.transferFrom(
        ownerAccount.address,
        RECIPIENT,
        TRANSFER_AMOUNT
    ).send({ from: spenderAccount.address });

    console.log("Transfer tx hash:", transferTx.transactionHash);
    console.log("Transfer status:", transferTx.status ? "SUCCESS" : "REVERTED");
    console.log("Gas used:", transferTx.gasUsed.toString());

    // Final balances
    console.log("\n==================== FINAL BALANCES ====================");
    const ownerBalanceAfter = await token.methods.balanceOf(ownerAccount.address).call();
    const recipientBalanceAfter = await token.methods.balanceOf(RECIPIENT).call();
    console.log("Owner balance:", fmt(ownerBalanceAfter), symbol);
    console.log("Recipient balance:", fmt(recipientBalanceAfter), symbol);
}

permitTransfer().catch((err) => {
    console.error("Error in permit transfer:", err.message);
    process.exit(1);
});
