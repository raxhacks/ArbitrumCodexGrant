const { Web3 } = require("web3");

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

function padSlot(slot) {
    const hex = typeof slot === "string" ? slot : "0x" + slot.toString(16);
    return Web3.utils.padLeft(hex, 64);
}

function computeMappingSlot(web3, key, mappingSlot) {
    const encoded = web3.eth.abi.encodeParameters(["uint256", "uint256"], [key.toString(), mappingSlot.toString()]);
    return web3.utils.keccak256(encoded);
}

function computeAddressMappingSlot(web3, key, mappingSlot) {
    const encoded = web3.eth.abi.encodeParameters(["address", "uint256"], [key, mappingSlot.toString()]);
    return web3.utils.keccak256(encoded);
}

function computeArraySlot(web3, arraySlot) {
    const encoded = web3.eth.abi.encodeParameter("uint256", arraySlot.toString());
    return web3.utils.keccak256(encoded);
}

// ==================== MAIN ====================
async function readStorageSlot() {
    const web3 = new Web3(RPC_URL);

    // Verify contract exists
    const code = await web3.eth.getCode(CONTRACT_ADDRESS);
    if (code === "0x") {
        console.log("No contract at address:", CONTRACT_ADDRESS);
        process.exit(1);
    }

    console.log("==================== CONTRACT ====================");
    console.log("Address:", CONTRACT_ADDRESS);

    // Read single slot
    const slotHex = padSlot(SLOT_NUMBER);
    const rawValue = await web3.eth.getStorageAt(CONTRACT_ADDRESS, slotHex);

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
        const utf8 = web3.utils.hexToUtf8(rawValue.replace(/0+$/, "") || "0x");
        console.log("As string:", utf8);
    } catch {
        console.log("As string: (not valid UTF-8)");
    }

    // Read multiple consecutive slots
    console.log("\n==================== CONSECUTIVE SLOTS ====================");
    const numSlots = 10;
    const startSlot = BigInt(SLOT_NUMBER);
    const zeroValue = "0x0000000000000000000000000000000000000000000000000000000000000000";

    for (let i = 0n; i < BigInt(numSlots); i++) {
        const slot = startSlot + i;
        const slotKey = padSlot(slot);
        const value = await web3.eth.getStorageAt(CONTRACT_ADDRESS, slotKey);

        if (value !== zeroValue) {
            console.log(`  Slot ${slot.toString()}: ${value}`);
            console.log(`    uint256: ${decodeAsUint256(value).toString()}`);
            console.log(`    address: ${decodeAsAddress(value)}`);
        }
    }

    // Mapping slot example
    console.log("\n==================== MAPPING SLOT CALCULATOR ====================");
    const exampleKey = 1;
    const exampleMappingSlot = 0;
    const mappingSlot = computeMappingSlot(web3, exampleKey, exampleMappingSlot);
    const mappingValue = await web3.eth.getStorageAt(CONTRACT_ADDRESS, mappingSlot);
    console.log(`mapping[${exampleKey}] at base slot ${exampleMappingSlot}:`);
    console.log("  Computed slot:", mappingSlot);
    console.log("  Value:", mappingValue);

    // Array slot example
    console.log("\n==================== ARRAY SLOT CALCULATOR ====================");
    const exampleArraySlot = 0;
    const arrayDataSlot = computeArraySlot(web3, exampleArraySlot);
    console.log(`Array at base slot ${exampleArraySlot}:`);

    const arrayLength = await web3.eth.getStorageAt(CONTRACT_ADDRESS, padSlot(exampleArraySlot));
    console.log("  Length slot value:", decodeAsUint256(arrayLength).toString());
    console.log("  Data start slot:", arrayDataSlot);

    const arrayLen = Number(decodeAsUint256(arrayLength));
    const displayLen = Math.min(arrayLen, 5);
    for (let i = 0; i < displayLen; i++) {
        const elementSlot = padSlot(BigInt(arrayDataSlot) + BigInt(i));
        const elementValue = await web3.eth.getStorageAt(CONTRACT_ADDRESS, elementSlot);
        console.log(`  [${i}]: ${elementValue}`);
    }
}

readStorageSlot().catch((err) => {
    console.error("Error reading storage:", err.message);
    process.exit(1);
});
