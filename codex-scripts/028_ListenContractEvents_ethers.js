const { ethers } = require("ethers");

const WS_URL = "wss://arb1.arbitrum.io/ws";
const RPC_URL = "https://arb1.arbitrum.io/rpc";
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const POLL_INTERVAL_MS = 3000;
const MAX_EVENTS = Number(process.env.MAX_EVENTS ?? 10);
const MAX_DURATION_MS = Number(process.env.MAX_DURATION_MS ?? 8000);

// Replace with your contract's events
const CONTRACT_ABI = [
    "event Transfer(address indexed from, address indexed to, uint256 value)",
    "event Approval(address indexed owner, address indexed spender, uint256 value)",
    "event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)",
];

// Set to null to listen to all events, or specify event name
const EVENT_NAME = null; // null = all events, or "Transfer", "Approval", etc.

function formatEventArgs(fragment, args) {
    const result = {};
    fragment.inputs.forEach((input, i) => {
        let value = args[i];
        let display = value.toString();

        if (input.type === "uint256") {
            display = value.toString();
            if (BigInt(value) > 10n ** 15n) {
                display += ` (${ethers.formatEther(value)} ETH/tokens)`;
            }
        } else if (input.type === "bool") {
            display = value ? "true" : "false";
        }

        result[input.name] = {
            type: input.type,
            indexed: input.indexed,
            value: display,
        };
    });
    return result;
}

let eventCount = 0;

function printEvent(parsed, log, timestamp) {
    eventCount++;
    console.log(`\nEVENT #${eventCount} [${timestamp}]`);
    console.log("Name:", parsed.name);
    console.log("Block:", log.blockNumber);
    console.log("Tx:", log.transactionHash);
    console.log("Log index:", log.index !== undefined ? log.index : log.logIndex);
    console.log("Contract:", log.address);

    const formatted = formatEventArgs(parsed.fragment, parsed.args);
    console.log("Args:");
    Object.entries(formatted).forEach(([name, info]) => {
        const indexTag = info.indexed ? " [indexed]" : "";
        console.log(`  ${name} (${info.type}${indexTag}): ${info.value}`);
    });
}

async function listenWebSocket() {
    console.log("EVENT LISTENER (WebSocket)");
    console.log("Contract:", CONTRACT_ADDRESS);
    console.log("Filter:", EVENT_NAME || "ALL EVENTS");
    console.log("WebSocket:", WS_URL);
    console.log("\nListening...\n");

    const provider = new ethers.WebSocketProvider(WS_URL);

    // Wait for WS to connect or fail before setting up listeners
    await new Promise((resolve, reject) => {
        provider.websocket.on("open", resolve);
        provider.websocket.on("error", reject);
    });

    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
    const iface = new ethers.Interface(CONTRACT_ABI);

    if (EVENT_NAME) {
        // Listen to specific event
        contract.on(EVENT_NAME, (...args) => {
            const event = args[args.length - 1];
            const timestamp = new Date().toISOString();

            try {
                const parsed = iface.parseLog({ topics: event.log.topics, data: event.log.data });
                printEvent(parsed, event.log, timestamp);
            } catch {
                console.log(`\n[${timestamp}] Raw event from ${event.log.address}`);
                console.log("Topics:", event.log.topics);
                console.log("Data:", event.log.data);
            }
        });
    } else {
        // Listen to all events using wildcard filter
        const filter = { address: CONTRACT_ADDRESS };

        provider.on(filter, (log) => {
            const timestamp = new Date().toISOString();

            try {
                const parsed = iface.parseLog({ topics: log.topics, data: log.data });
                printEvent(parsed, log, timestamp);
            } catch {
                console.log(`\n[${timestamp}] Unknown event`);
                console.log("Address:", log.address);
                console.log("Topics:", log.topics);
                console.log("Data:", log.data);
                console.log("Block:", log.blockNumber);
                console.log("Tx:", log.transactionHash);
            }
        });
    }

    // Handle WebSocket disconnection by falling back to polling
    provider.websocket.on("close", () => {
        console.log("\nWebSocket disconnected. Switching to polling fallback...");
        provider.destroy();
        listenPolling();
    });

    process.once("SIGINT", () => {
        console.log(`\n\nStopping listener. Total events captured: ${eventCount}`);
        provider.destroy();
        process.exit(0);
    });
}

async function listenPolling() {
    console.log("EVENT LISTENER (Polling)");
    console.log("Contract:", CONTRACT_ADDRESS);
    console.log("Filter:", EVENT_NAME || "ALL EVENTS");
    console.log("RPC:", RPC_URL);
    console.log(`Poll interval: ${POLL_INTERVAL_MS / 1000}s`);
    console.log("\nListening...\n");

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
    const iface = new ethers.Interface(CONTRACT_ABI);

    let lastBlock = await provider.getBlockNumber();
    console.log("Starting from block:", lastBlock);

    const poll = async () => {
        try {
            const currentBlock = await provider.getBlockNumber();
            if (currentBlock <= lastBlock) return;

            let filter;
            if (EVENT_NAME) {
                filter = contract.filters[EVENT_NAME]();
            } else {
                filter = { address: CONTRACT_ADDRESS };
            }

            const logs = EVENT_NAME
                ? await contract.queryFilter(filter, lastBlock + 1, currentBlock)
                : await provider.getLogs({ ...filter, fromBlock: lastBlock + 1, toBlock: currentBlock });

            for (const log of logs) {
                const timestamp = new Date().toISOString();
                try {
                    const parsed = iface.parseLog({ topics: log.topics, data: log.data });
                    printEvent(parsed, log, timestamp);
                } catch {
                    console.log(`\n[${timestamp}] Unknown event`);
                    console.log("Address:", log.address);
                    console.log("Topics:", log.topics);
                    console.log("Data:", log.data);
                    console.log("Block:", log.blockNumber);
                    console.log("Tx:", log.transactionHash);
                }
            }

            lastBlock = currentBlock;
        } catch (err) {
            console.error("Poll error:", err.message);
        }
    };

    const interval = setInterval(() => {
        poll();
        if (eventCount >= MAX_EVENTS) {
            console.log(`\n\nReached MAX_EVENTS=${MAX_EVENTS}. Stopping.`);
            clearInterval(interval);
            process.exit(0);
        }
    }, POLL_INTERVAL_MS);

    setTimeout(() => {
        console.log(`\n\nReached MAX_DURATION_MS=${MAX_DURATION_MS}. Total events captured: ${eventCount}`);
        clearInterval(interval);
        process.exit(0);
    }, MAX_DURATION_MS);

    process.once("SIGINT", () => {
        console.log(`\n\nStopping listener. Total events captured: ${eventCount}`);
        clearInterval(interval);
        process.exit(0);
    });
}

(async () => {
    try {
        await listenWebSocket();
    } catch (err) {
        console.log("WebSocket unavailable, falling back to polling...");
        console.log("Reason:", err.message, "\n");
        await listenPolling();
    }
})();
