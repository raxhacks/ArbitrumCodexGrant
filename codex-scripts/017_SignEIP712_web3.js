const { Web3 } = require("web3");
const { secp256k1 } = require("ethereum-cryptography/secp256k1");

// ==================== CONFIGURATION ====================
const PRIVATE_KEY = "YOUR_PRIVATE_KEY_HERE";

// ==================== EIP-712 TYPED DATA ====================
const typedData = {
    types: {
        EIP712Domain: [
            { name: "name", type: "string" },
            { name: "version", type: "string" },
            { name: "chainId", type: "uint256" },
            { name: "verifyingContract", type: "address" },
        ],
        Order: [
            { name: "maker", type: "address" },
            { name: "taker", type: "address" },
            { name: "amount", type: "uint256" },
            { name: "nonce", type: "uint256" },
            { name: "deadline", type: "uint256" },
        ],
    },
    primaryType: "Order",
    domain: {
        name: "ExampleDApp",
        version: "1",
        chainId: "42161",
        verifyingContract: "0x0000000000000000000000000000000000000001",
    },
    message: {
        maker: "0x0000000000000000000000000000000000000001",
        taker: "0x0000000000000000000000000000000000000002",
        amount: Web3.utils.toWei("1.0", "ether"),
        nonce: "0",
        deadline: (Math.floor(Date.now() / 1000) + 3600).toString(),
    },
};

// ==================== HELPERS ====================
function encodeType(typeName, types) {
    const fields = types[typeName];
    return `${typeName}(${fields.map((f) => `${f.type} ${f.name}`).join(",")})`;
}

function hashType(web3, typeName, types) {
    const encoded = encodeType(typeName, types);
    return web3.utils.keccak256(encoded);
}

function encodeData(web3, typeName, types, data) {
    const typeHash = hashType(web3, typeName, types);
    const fields = types[typeName];

    const encodedValues = [typeHash];
    for (const field of fields) {
        const value = data[field.name];
        if (field.type === "string") {
            encodedValues.push(web3.utils.keccak256(value));
        } else if (field.type === "bytes") {
            encodedValues.push(web3.utils.keccak256(value));
        } else if (field.type === "address") {
            encodedValues.push(web3.utils.padLeft(value.toLowerCase(), 64));
        } else if (field.type.startsWith("uint") || field.type.startsWith("int")) {
            encodedValues.push(web3.utils.padLeft(web3.utils.toHex(value), 64));
        } else if (field.type === "bool") {
            encodedValues.push(web3.utils.padLeft(value ? "0x1" : "0x0", 64));
        } else {
            encodedValues.push(web3.utils.padLeft(web3.utils.toHex(value), 64));
        }
    }

    return "0x" + encodedValues.map((v) => v.replace("0x", "").padStart(64, "0")).join("");
}

function hashStruct(web3, typeName, types, data) {
    const encoded = encodeData(web3, typeName, types, data);
    return web3.utils.keccak256(encoded);
}

// ==================== MAIN ====================
async function signEIP712() {
    const web3 = new Web3();
    const account = web3.eth.accounts.privateKeyToAccount(PRIVATE_KEY);

    console.log("==================== SIGNER ====================");
    console.log("Address:", account.address);

    // Display domain
    console.log("\n==================== EIP-712 DOMAIN ====================");
    console.log("Name:", typedData.domain.name);
    console.log("Version:", typedData.domain.version);
    console.log("Chain ID:", typedData.domain.chainId);
    console.log("Verifying contract:", typedData.domain.verifyingContract);

    // Display types
    console.log("\n==================== EIP-712 TYPES ====================");
    Object.entries(typedData.types).forEach(([typeName, fields]) => {
        if (typeName === "EIP712Domain") return;
        console.log(`${typeName}:`);
        fields.forEach((f) => console.log(`  ${f.name}: ${f.type}`));
    });

    // Display message
    console.log("\n==================== EIP-712 MESSAGE ====================");
    Object.entries(typedData.message).forEach(([key, value]) => {
        let display = value.toString();
        if (key === "amount") display = `${value} (${Web3.utils.fromWei(value, "ether")} ETH)`;
        if (key === "deadline") display = `${value} (${new Date(Number(value) * 1000).toISOString()})`;
        console.log(`${key}: ${display}`);
    });

    // Compute hashes
    console.log("\n==================== HASHES ====================");
    const domainSeparator = hashStruct(web3, "EIP712Domain", typedData.types, typedData.domain);
    console.log("Domain separator:", domainSeparator);

    const structHash = hashStruct(web3, typedData.primaryType, typedData.types, typedData.message);
    console.log("Struct hash:", structHash);

    // EIP-712 hash: keccak256("\x19\x01" || domainSeparator || structHash)
    const fullHash = web3.utils.keccak256(
        "0x1901" +
        domainSeparator.replace("0x", "") +
        structHash.replace("0x", "")
    );
    console.log("EIP-712 hash:", fullHash);

    // Sign the hash using raw ECDSA (no Ethereum message prefix)
    // account.sign() adds "\x19Ethereum Signed Message" prefix which breaks EIP-712
    console.log("\n==================== SIGNATURE ====================");
    const ecSig = secp256k1.sign(fullHash.slice(2), PRIVATE_KEY.slice(2));
    const r = "0x" + ecSig.r.toString(16).padStart(64, "0");
    const s = "0x" + ecSig.s.toString(16).padStart(64, "0");
    const v = "0x" + (ecSig.recovery + 27).toString(16).padStart(2, "0");
    const signature = r + s.slice(2) + v.slice(2);
    console.log("Signature:", signature);
    console.log("v:", v);
    console.log("r:", r);
    console.log("s:", s);

    // Verify using ecrecover without message prefix (prefixed=true means hash is already final)
    console.log("\n==================== VERIFICATION ====================");
    const recovered = web3.eth.accounts.recover(fullHash, v, r, s, true);
    console.log("Recovered address:", recovered);
    console.log("Valid:", recovered.toLowerCase() === account.address.toLowerCase());
}

signEIP712().catch((err) => {
    console.error("Error signing EIP-712 message:", err.message);
    process.exit(1);
});
