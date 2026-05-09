const { Web3 } = require("web3");

const RPC_URLS = {
    mainnet: {
        http: "https://arb1.arbitrum.io/rpc",
        ws: "wss://arb1.arbitrum.io/ws",
    },
    fallback1: {
        http: "https://arbitrum-one-rpc.publicnode.com",
    },
    fallback2: {
        http: "https://1rpc.io/arb",
    },
};

const CONNECTION_TIMEOUT_MS = 5000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

class RPCConnection {
    constructor() {
        this.web3 = null;
        this.wsWeb3 = null;
        this.chainId = null;
        this.networkName = null;
        this.activeRpc = null;
    }

    async _testConnection(rpcUrl) {
        const web3 = new Web3(rpcUrl);

        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Connection timeout")), CONNECTION_TIMEOUT_MS)
        );

        const connectPromise = (async () => {
            const blockNumber = Number(await web3.eth.getBlockNumber());
            const chainId = Number(await web3.eth.getChainId());
            return { web3, blockNumber, chainId };
        })();

        return Promise.race([connectPromise, timeoutPromise]);
    }

    async connectHTTP() {
        console.log("HTTP RPC INITIALIZATION");

        const endpoints = [
            { name: "mainnet", url: RPC_URLS.mainnet.http },
            { name: "fallback1", url: RPC_URLS.fallback1.http },
            { name: "fallback2", url: RPC_URLS.fallback2.http },
        ];

        for (const endpoint of endpoints) {
            for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
                try {
                    console.log(`\nTrying ${endpoint.name} (attempt ${attempt}/${MAX_RETRIES})...`);
                    console.log("URL:", endpoint.url);

                    const result = await this._testConnection(endpoint.url);

                    this.web3 = result.web3;
                    this.chainId = result.chainId;
                    this.activeRpc = endpoint.url;

                    console.log("Status: CONNECTED");
                    console.log("Chain ID:", this.chainId);
                    console.log("Block:", result.blockNumber);

                    return true;
                } catch (err) {
                    console.log(`Status: FAILED - ${err.message}`);
                    if (attempt < MAX_RETRIES) {
                        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
                    }
                }
            }
        }

        console.log("\nAll HTTP endpoints failed.");
        return false;
    }

    async connectWebSocket() {
        if (!RPC_URLS.mainnet.ws) {
            console.log("\nNo WebSocket URL configured.");
            return false;
        }

        console.log("\nWEBSOCKET INITIALIZATION");
        console.log("URL:", RPC_URLS.mainnet.ws);

        try {
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("WebSocket timeout")), CONNECTION_TIMEOUT_MS)
            );

            const connectPromise = (async () => {
                const wsWeb3 = new Web3(RPC_URLS.mainnet.ws);
                const blockNumber = Number(await wsWeb3.eth.getBlockNumber());
                return { wsWeb3, blockNumber };
            })();

            const result = await Promise.race([connectPromise, timeoutPromise]);
            this.wsWeb3 = result.wsWeb3;

            console.log("Status: CONNECTED");
            console.log("Block:", result.blockNumber);

            return true;
        } catch (err) {
            console.log("Status: FAILED -", err.message);
            return false;
        }
    }

    async benchmark() {
        if (!this.web3) return;

        console.log("\nRPC BENCHMARK");

        const tests = [
            { name: "eth_blockNumber", fn: () => this.web3.eth.getBlockNumber() },
            { name: "eth_chainId", fn: () => this.web3.eth.getChainId() },
            { name: "eth_gasPrice", fn: () => this.web3.eth.getGasPrice() },
            { name: "eth_getBlockByNumber", fn: () => this.web3.eth.getBlock("latest") },
        ];

        for (const test of tests) {
            const times = [];
            for (let i = 0; i < 3; i++) {
                const start = Date.now();
                await test.fn();
                times.push(Date.now() - start);
            }
            const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
            const min = Math.min(...times);
            const max = Math.max(...times);
            console.log(`  ${test.name}: avg ${avg}ms | min ${min}ms | max ${max}ms`);
        }
    }

    async getFullStatus() {
        if (!this.web3) return;

        console.log("\nRPC STATUS");
        console.log("Active RPC:", this.activeRpc);
        console.log("Chain ID:", this.chainId);

        const blockNumber = Number(await this.web3.eth.getBlockNumber());
        const block = await this.web3.eth.getBlock(blockNumber);
        const gasPrice = await this.web3.eth.getGasPrice();

        console.log("Current block:", blockNumber);
        console.log("Block timestamp:", new Date(Number(block.timestamp) * 1000).toISOString());
        console.log("Block gas limit:", block.gasLimit.toString());
        console.log("Block tx count:", block.transactions.length);
        console.log("Gas price:", Web3.utils.fromWei(gasPrice, "gwei"), "gwei");

        try {
            const feeHistory = await this.web3.eth.getFeeHistory(1, "latest", [25, 50, 75]);
            if (feeHistory.baseFeePerGas && feeHistory.baseFeePerGas.length > 0) {
                console.log("Base fee:", Web3.utils.fromWei(feeHistory.baseFeePerGas[0].toString(), "gwei"), "gwei");
            }
            if (feeHistory.reward && feeHistory.reward.length > 0) {
                console.log("Priority fee (25th):", Web3.utils.fromWei(feeHistory.reward[0][0].toString(), "gwei"), "gwei");
                console.log("Priority fee (50th):", Web3.utils.fromWei(feeHistory.reward[0][1].toString(), "gwei"), "gwei");
                console.log("Priority fee (75th):", Web3.utils.fromWei(feeHistory.reward[0][2].toString(), "gwei"), "gwei");
            }
        } catch {
            console.log("Fee history: N/A");
        }

        // Sync status
        const latestTimestamp = Number(block.timestamp);
        const now = Math.floor(Date.now() / 1000);
        const drift = now - latestTimestamp;
        console.log("\nBlock age:", drift, "seconds");
        console.log("Sync status:", drift < 60 ? "SYNCED" : drift < 300 ? "SLIGHTLY BEHIND" : "OUT OF SYNC");

        // WebSocket status
        if (this.wsWeb3) {
            console.log("WebSocket: CONNECTED");
        } else {
            console.log("WebSocket: NOT CONNECTED");
        }
    }

    async disconnect() {
        if (this.wsWeb3) {
            this.wsWeb3.currentProvider.disconnect();
            console.log("\nWebSocket disconnected.");
        }
        console.log("HTTP provider disconnected.");
    }
}

async function initRPC() {
    const rpc = new RPCConnection();

    // Connect HTTP
    const httpConnected = await rpc.connectHTTP();
    if (!httpConnected) {
        console.log("Failed to connect to any RPC endpoint.");
        process.exit(1);
    }

    // Connect WebSocket
    await rpc.connectWebSocket();

    // Benchmark
    await rpc.benchmark();

    // Full status
    await rpc.getFullStatus();

    // Summary
    console.log("\nINITIALIZATION COMPLETE");
    console.log("HTTP: READY");
    console.log("WebSocket:", rpc.wsWeb3 ? "READY" : "UNAVAILABLE");
    console.log("RPC:", rpc.activeRpc);
    console.log("Chain:", rpc.chainId);

    // Cleanup
    await rpc.disconnect();
}

initRPC().catch((err) => {
    console.error("Error initializing RPC:", err.message);
    process.exit(1);
});
