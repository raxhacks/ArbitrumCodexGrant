const { ethers } = require("ethers");

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
        this.provider = null;
        this.wsProvider = null;
        this.chainId = null;
        this.networkName = null;
        this.activeRpc = null;
    }

    async _testConnection(rpcUrl) {
        const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, {
            staticNetwork: null,
        });

        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Connection timeout")), CONNECTION_TIMEOUT_MS)
        );

        const connectPromise = (async () => {
            const blockNumber = await provider.getBlockNumber();
            const network = await provider.getNetwork();
            return { provider, blockNumber, chainId: Number(network.chainId) };
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

                    this.provider = result.provider;
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

            const connectPromise = new Promise((resolve, reject) => {
                const wsProvider = new ethers.WebSocketProvider(RPC_URLS.mainnet.ws);
                wsProvider.websocket.on("error", (err) => reject(err));
                wsProvider.getBlockNumber().then(
                    (blockNumber) => resolve({ wsProvider, blockNumber }),
                    (err) => reject(err),
                );
            });

            const result = await Promise.race([connectPromise, timeoutPromise]);
            this.wsProvider = result.wsProvider;

            console.log("Status: CONNECTED");
            console.log("Block:", result.blockNumber);

            return true;
        } catch (err) {
            console.log("Status: FAILED -", err.message);
            return false;
        }
    }

    async benchmark() {
        if (!this.provider) return;

        console.log("\nRPC BENCHMARK");

        const tests = [
            { name: "eth_blockNumber", fn: () => this.provider.getBlockNumber() },
            { name: "eth_chainId", fn: () => this.provider.getNetwork() },
            { name: "eth_gasPrice", fn: () => this.provider.getFeeData() },
            { name: "eth_getBlockByNumber", fn: () => this.provider.getBlock("latest") },
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
        if (!this.provider) return;

        console.log("\nRPC STATUS");
        console.log("Active RPC:", this.activeRpc);
        console.log("Chain ID:", this.chainId);

        const blockNumber = await this.provider.getBlockNumber();
        const block = await this.provider.getBlock(blockNumber);
        const feeData = await this.provider.getFeeData();
        const network = await this.provider.getNetwork();

        console.log("Network name:", network.name);
        console.log("Current block:", blockNumber);
        console.log("Block timestamp:", new Date(block.timestamp * 1000).toISOString());
        console.log("Block gas limit:", block.gasLimit.toString());
        console.log("Block tx count:", block.transactions.length);
        const gasPrice = feeData.gasPrice ?? feeData.maxFeePerGas ?? 0n;
        console.log("Gas price:", ethers.formatUnits(gasPrice, "gwei"), "gwei");

        if (feeData.maxFeePerGas) {
            console.log("Max fee per gas:", ethers.formatUnits(feeData.maxFeePerGas, "gwei"), "gwei");
        }
        if (feeData.maxPriorityFeePerGas) {
            console.log("Max priority fee:", ethers.formatUnits(feeData.maxPriorityFeePerGas, "gwei"), "gwei");
        }

        // Sync status
        const latestTimestamp = block.timestamp;
        const now = Math.floor(Date.now() / 1000);
        const drift = now - latestTimestamp;
        console.log("\nBlock age:", drift, "seconds");
        console.log("Sync status:", drift < 60 ? "SYNCED" : drift < 300 ? "SLIGHTLY BEHIND" : "OUT OF SYNC");

        // WebSocket status
        if (this.wsProvider) {
            console.log("WebSocket: CONNECTED");
        } else {
            console.log("WebSocket: NOT CONNECTED");
        }
    }

    async disconnect() {
        if (this.wsProvider) {
            this.wsProvider.destroy();
            console.log("\nWebSocket disconnected.");
        }
        if (this.provider) {
            this.provider.destroy();
            console.log("HTTP provider disconnected.");
        }
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
    console.log("WebSocket:", rpc.wsProvider ? "READY" : "UNAVAILABLE");
    console.log("RPC:", rpc.activeRpc);
    console.log("Chain:", rpc.chainId);

    // Cleanup
    await rpc.disconnect();
}

initRPC().catch((err) => {
    console.error("Error initializing RPC:", err.message);
    process.exit(1);
});
