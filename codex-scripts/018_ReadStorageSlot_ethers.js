const { ethers } = require("ethers");

// ==================== CONFIGURATION ====================
const RPC_URL = "https://arb1.arbitrum.io/rpc";
const CONTRACT_ADDRESS = "YOUR_CONTRACT_ADDRESS_HERE";
const SLOT_NUMBER = 0; // Storage slot to read (number or hex string)

// ==================== HELPERS ====================
function decodeAsAddress(data) {
    return "0x" + data.slice(26);
}

function decodeAsUint256(data) {
    return BigInt(data);
}

function decodeAsBool(data) {
    return BigInt(data) !== 0n;
}

function computeMappingSlot(key, mappingSlot) {
    return ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(["uint256", "uint256"], [key, mappingSlot])
    );
}

function computeAddressMappingSlot(key, mappingSlot) {
    return ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(["address", "uint256"], [key, mappingSlot])
    );
}

function computeArraySlot(arraySlot) {
    return ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [arraySlot])
    );
}

// ==================== MAIN ====================
async function readStorageSlot() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    // Verify contract exists
    const code = await provider.getCode(CONTRACT_ADDRESS);
    if (code === "0x") {
        console.log("No contract at address:", CONTRACT_ADDRESS);
        process.exit(1);
    }

    console.log("==================== CONTRACT ====================");
    console.log("Address:", CONTRACT_ADDRESS);

    // Read single slot
    const slotHex = typeof SLOT_NUMBER === "string" ? SLOT_NUMBER : ethers.toBeHex(SLOT_NUMBER, 32);
    const rawValue = await provider.getStorage(CONTRACT_ADDRESS, slotHex);

    console.log("\n==================== STORAGE SLOT ====================");
    console.log("Slot:", slotHex);
    console.log("Raw value:", rawValue);

    // Decode as different types
    console.log("\n==================== DECODED VALUES ====================");
    console.log("As uint256:", decodeAsUint256(rawValue).toString());
    console.log("As int256:", BigInt.asIntN(256, decodeAsUint256(rawValue)).toString());
    console.log("As address:", decodeAsAddress(rawValue));
    console.log("As bool:", decodeAsBool(rawValue));
    console.log("As bytes32:", rawValue);

    try {
        const utf8 = ethers.toUtf8String(rawValue.replace(/0+$/, "") || "0x");
        console.log("As string:", utf8);
    } catch {
        console.log("As string: (not valid UTF-8)");
    }

    // Read multiple consecutive slots
    console.log("\n==================== CONSECUTIVE SLOTS ====================");
    const numSlots = 10;
    const startSlot = BigInt(SLOT_NUMBER);

    for (let i = 0n; i < BigInt(numSlots); i++) {
        const slot = startSlot + i;
        const slotKey = ethers.toBeHex(slot, 32);
        const value = await provider.getStorage(CONTRACT_ADDRESS, slotKey);

        if (value !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
            console.log(`  Slot ${slot.toString()}: ${value}`);
            console.log(`    uint256: ${decodeAsUint256(value).toString()}`);
            console.log(`    address: ${decodeAsAddress(value)}`);
        }
    }

    // Mapping slot example
    console.log("\n==================== MAPPING SLOT CALCULATOR ====================");
    const exampleKey = 1;
    const exampleMappingSlot = 0;
    const mappingSlot = computeMappingSlot(exampleKey, exampleMappingSlot);
    const mappingValue = await provider.getStorage(CONTRACT_ADDRESS, mappingSlot);
    console.log(`mapping[${exampleKey}] at base slot ${exampleMappingSlot}:`);
    console.log("  Computed slot:", mappingSlot);
    console.log("  Value:", mappingValue);

    // Array slot example
    console.log("\n==================== ARRAY SLOT CALCULATOR ====================");
    const exampleArraySlot = 0;
    const arrayDataSlot = computeArraySlot(exampleArraySlot);
    console.log(`Array at base slot ${exampleArraySlot}:`);

    const arrayLength = await provider.getStorage(CONTRACT_ADDRESS, ethers.toBeHex(exampleArraySlot, 32));
    console.log("  Length slot value:", decodeAsUint256(arrayLength).toString());
    console.log("  Data start slot:", arrayDataSlot);

    const arrayLen = Number(decodeAsUint256(arrayLength));
    const displayLen = Math.min(arrayLen, 5);
    for (let i = 0; i < displayLen; i++) {
        const elementSlot = ethers.toBeHex(BigInt(arrayDataSlot) + BigInt(i), 32);
        const elementValue = await provider.getStorage(CONTRACT_ADDRESS, elementSlot);
        console.log(`  [${i}]: ${elementValue}`);
    }
}

readStorageSlot().catch((err) => {
    console.error("Error reading storage:", err.message);
    process.exit(1);
});
