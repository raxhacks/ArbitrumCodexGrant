const { ethers } = require("ethers");

// ==================== CONFIGURATION ====================
const PRIVATE_KEY = "YOUR_PRIVATE_KEY_HERE";

// ==================== EIP-712 DOMAIN ====================
const domain = {
    name: "ExampleDApp",
    version: "1",
    chainId: 42161,
    verifyingContract: "0x0000000000000000000000000000000000000001",
};

// ==================== EIP-712 TYPES ====================
const types = {
    Order: [
        { name: "maker", type: "address" },
        { name: "taker", type: "address" },
        { name: "amount", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
    ],
};

// ==================== EIP-712 MESSAGE ====================
const message = {
    maker: "0x0000000000000000000000000000000000000001",
    taker: "0x0000000000000000000000000000000000000002",
    amount: ethers.parseEther("1.0"),
    nonce: 0,
    deadline: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
};

// ==================== MAIN ====================
async function signEIP712() {
    const wallet = new ethers.Wallet(PRIVATE_KEY);

    console.log("==================== SIGNER ====================");
    console.log("Address:", wallet.address);

    // Display domain
    console.log("\n==================== EIP-712 DOMAIN ====================");
    console.log("Name:", domain.name);
    console.log("Version:", domain.version);
    console.log("Chain ID:", domain.chainId);
    console.log("Verifying contract:", domain.verifyingContract);

    // Display types
    console.log("\n==================== EIP-712 TYPES ====================");
    Object.entries(types).forEach(([typeName, fields]) => {
        console.log(`${typeName}:`);
        fields.forEach((f) => console.log(`  ${f.name}: ${f.type}`));
    });

    // Display message
    console.log("\n==================== EIP-712 MESSAGE ====================");
    Object.entries(message).forEach(([key, value]) => {
        let display = value.toString();
        if (key === "amount") display = `${value.toString()} (${ethers.formatEther(value)} ETH)`;
        if (key === "deadline") display = `${value} (${new Date(value * 1000).toISOString()})`;
        console.log(`${key}: ${display}`);
    });

    // Compute domain separator
    const domainSeparator = ethers.TypedDataEncoder.hashDomain(domain);
    console.log("\n==================== HASHES ====================");
    console.log("Domain separator:", domainSeparator);

    // Compute struct hash
    const structHash = ethers.TypedDataEncoder.hashStruct("Order", types, message);
    console.log("Struct hash:", structHash);

    // Compute full EIP-712 hash
    const fullHash = ethers.TypedDataEncoder.hash(domain, types, message);
    console.log("EIP-712 hash:", fullHash);

    // Sign
    console.log("\n==================== SIGNATURE ====================");
    const signature = await wallet.signTypedData(domain, types, message);
    console.log("Signature:", signature);

    // Split signature
    const sig = ethers.Signature.from(signature);
    console.log("v:", sig.v);
    console.log("r:", sig.r);
    console.log("s:", sig.s);

    // Verify
    console.log("\n==================== VERIFICATION ====================");
    const recovered = ethers.verifyTypedData(domain, types, message, signature);
    console.log("Recovered address:", recovered);
    console.log("Valid:", recovered.toLowerCase() === wallet.address.toLowerCase());

    // Encoded data for on-chain verification
    console.log("\n==================== ENCODED DATA ====================");
    const encoded = ethers.TypedDataEncoder.encode(domain, types, message);
    console.log("Encoded typed data:", encoded);
}

signEIP712().catch((err) => {
    console.error("Error signing EIP-712 message:", err.message);
    process.exit(1);
});
