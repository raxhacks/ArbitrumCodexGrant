const { Web3 } = require("web3");
const https = require("https");
const http = require("http");

// ==================== CONFIGURATION ====================
const RPC_URL = "https://arb1.arbitrum.io/rpc";
const BLOCKSCOUT_API_URL = "https://arbitrum.blockscout.com/api";
const CONTRACT_ADDRESS = "YOUR_CONTRACT_ADDRESS_HERE";
const CONTRACT_NAME = "MyContract";
const COMPILER_VERSION = "v0.8.19+commit.7dd6d404";
const OPTIMIZATION_ENABLED = true;
const OPTIMIZATION_RUNS = 200;
const EVM_VERSION = "paris";
const LICENSE_TYPE = 2; // 1=Unlicense, 2=MIT, 3=GPLv2, 4=GPLv3, 5=LGPLv2, 6=LGPLv3, 7=BSD2, 8=BSD3, 9=MPL2, 10=OSL3, 11=Apache2, 12=AGPLv3, 13=BSL1

// Single file source code
const SOURCE_CODE = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MyContract {
    // Your contract source code here
}
`;

// Constructor arguments (ABI encoded, leave empty if none)
const CONSTRUCTOR_ARGS = "";

// ==================== HELPERS ====================
function httpRequest(url, method, data) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const protocol = parsedUrl.protocol === "https:" ? https : http;

        const boundary = "----FormBoundary" + Math.random().toString(36).slice(2);
        let body = "";

        Object.entries(data).forEach(([key, value]) => {
            body += `--${boundary}\r\n`;
            body += `Content-Disposition: form-data; name="${key}"\r\n\r\n`;
            body += `${value}\r\n`;
        });
        body += `--${boundary}--\r\n`;

        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port,
            path: parsedUrl.pathname + parsedUrl.search,
            method: method,
            headers: {
                "Content-Type": `multipart/form-data; boundary=${boundary}`,
                "Content-Length": Buffer.byteLength(body),
            },
        };

        const req = protocol.request(options, (res) => {
            let responseData = "";
            res.on("data", (chunk) => (responseData += chunk));
            res.on("end", () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(responseData) });
                } catch {
                    resolve({ status: res.statusCode, data: responseData });
                }
            });
        });

        req.on("error", reject);
        req.write(body);
        req.end();
    });
}

function httpGet(url) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const protocol = parsedUrl.protocol === "https:" ? https : http;

        protocol.get(url, (res) => {
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(data) });
                } catch {
                    resolve({ status: res.statusCode, data });
                }
            });
        }).on("error", reject);
    });
}

// ==================== MAIN ====================
async function verifyContract() {
    const web3 = new Web3(RPC_URL);

    // Verify contract exists
    const code = await web3.eth.getCode(CONTRACT_ADDRESS);
    if (code === "0x") {
        console.log("No contract deployed at:", CONTRACT_ADDRESS);
        process.exit(1);
    }

    console.log("==================== CONTRACT INFO ====================");
    console.log("Address:", CONTRACT_ADDRESS);
    console.log("Contract name:", CONTRACT_NAME);
    console.log("Compiler:", COMPILER_VERSION);
    console.log("Optimization:", OPTIMIZATION_ENABLED, `(${OPTIMIZATION_RUNS} runs)`);
    console.log("EVM version:", EVM_VERSION);

    // Check if already verified
    console.log("\n==================== CHECK VERIFICATION STATUS ====================");
    const checkUrl = `${BLOCKSCOUT_API_URL}?module=contract&action=getabi&address=${CONTRACT_ADDRESS}`;
    const checkResult = await httpGet(checkUrl);

    if (checkResult.data.status === "1") {
        console.log("Contract is already verified!");
        console.log("ABI:", checkResult.data.result.substring(0, 100) + "...");
        return;
    }

    console.log("Contract is not verified. Submitting verification...");

    // Submit verification
    console.log("\n==================== SUBMITTING VERIFICATION ====================");
    const verifyData = {
        module: "contract",
        action: "verifysourcecode",
        addressHash: CONTRACT_ADDRESS,
        name: CONTRACT_NAME,
        compilerVersion: COMPILER_VERSION,
        optimization: OPTIMIZATION_ENABLED ? "1" : "0",
        optimizationRuns: OPTIMIZATION_RUNS.toString(),
        evmVersion: EVM_VERSION,
        sourceCode: SOURCE_CODE,
        contractSourceCode: SOURCE_CODE,
        constructorArguments: CONSTRUCTOR_ARGS,
        licenseType: LICENSE_TYPE.toString(),
        autodetectConstructorArguments: CONSTRUCTOR_ARGS ? "false" : "true",
    };

    const submitResult = await httpRequest(BLOCKSCOUT_API_URL, "POST", verifyData);

    console.log("Response status:", submitResult.status);
    console.log("Response:", JSON.stringify(submitResult.data, null, 2));

    if (submitResult.data.status === "1" || submitResult.data.result) {
        const guid = submitResult.data.result;
        console.log("\nVerification submitted! GUID:", guid);

        // Poll for result
        console.log("\n==================== POLLING FOR RESULT ====================");
        let attempts = 0;
        const maxAttempts = 30;

        while (attempts < maxAttempts) {
            await new Promise((r) => setTimeout(r, 3000));
            attempts++;

            const statusUrl = `${BLOCKSCOUT_API_URL}?module=contract&action=checkverifystatus&guid=${guid}`;
            const statusResult = await httpGet(statusUrl);

            console.log(`Attempt ${attempts}/${maxAttempts}:`, statusResult.data.result || statusResult.data.message);

            if (statusResult.data.status === "1") {
                console.log("\nVerification successful!");
                break;
            }

            if (statusResult.data.result && statusResult.data.result.includes("Fail")) {
                console.log("\nVerification failed:", statusResult.data.result);
                break;
            }
        }

        if (attempts >= maxAttempts) {
            console.log("\nVerification timed out. Check manually on Blockscout.");
        }
    } else {
        console.log("\nVerification submission failed.");
        console.log("Error:", submitResult.data.message || submitResult.data);
    }
}

verifyContract().catch((err) => {
    console.error("Error verifying contract:", err.message);
    process.exit(1);
});
