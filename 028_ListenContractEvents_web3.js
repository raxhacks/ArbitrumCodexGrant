const { Web3 } = require("web3");

// ==================== CONFIGURATION ====================
const WS_URL = "wss://arb1.arbitrum.io/ws";
const RPC_URL = "https://arb1.arbitrum.io/rpc";
const CONTRACT_ADDRESS = "YOUR_CONTRACT_ADDRESS_HERE";
const POLL_INTERVAL_MS = 3000;

// ==================== ABI ====================
// Replace with your contract's events
const CONTRACT_ABI = [
    {
        name: "Transfer",
        type: "event",
        inputs: [
            { name: "from", type: "address", indexed: true },
            { name: "to", type: "address", indexed: true },
            { name: "value", type: "uint256", indexed: false },
        ],
    },
    {
        name: "Approval",
        type: "event",
        inputs: [
            { name: "owner", type: "address", indexed: true },
            { name: "spender", type: "address", indexed: true },
            { name: "value", type: "uint256", indexed: false },
        ],
    },
    {
        name: "OwnershipTransferred",
        type: "event",
        inputs: [
            { name: "previousOwner", type: "address", indexed: true },
            { name: "newOwner", type: "address", indexed: true },
        ],
    },
];

// ==================== EVENT FILTER ====================
const EVENT_NAME = null; // null = all events, or "Transfer", "Approval", etc.

// ==================== HELPERS ====================
let eventCount = 0;

function printEvent(eventAbi, returnValues, log, timestamp) {
    eventCount++;
    console.log(`\n==================== EVENT #${eventCount} [${timestamp}] ====================`);
    console.log("Name:", eventAbi.name);
    console.log("Block:", log.blockNumber.toString());
    console.log("Tx:", log.transactionHash);
    console.log("Log index:", log.logIndex.toString());
    console.log("Contract:", log.address);
    console.log("Args:");

    eventAbi.inputs.forEach((input) => {
        let value = returnValues[input.name];
        let display = value ? value.toString() : "N/A";

        if (input.type === "uint256" && value) {
            display = value.toString();
            if (BigInt(value) > 10n ** 15n) {
                display += ` (${Web3.utils.fromWei(value.toString(), "ether")} ETH/tokens)`;
            }
        } else if (input.type === "bool") {
            display = value ? "true" : "false";
        }

        const indexTag = input.indexed ? " [indexed]" : "";
        console.log(`  ${input.name} (${input.type}${indexTag}): ${display}`);
    });
}

function printRawLog(log, timestamp) {
    eventCount++;
    console.log(`\n==================== EVENT #${eventCount} [${timestamp}] ====================`);
    console.log("Name: UNKNOWN");
    console.log("Address:", log.address);
    console.log("Block:", log.blockNumber.toString());
    console.log("Tx:", log.transactionHash);
    console.log("Topics:", log.topics);
    console.log("Data:", log.data);
}

// ==================== WEBSOCKET LISTENER ====================
async function listenWebSocket() {
    console.log("==================== EVENT LISTENER (WebSocket) ====================");
    console.log("Contract:", CONTRACT_ADDRESS);
    console.log("Filter:", EVENT_NAME || "ALL EVENTS");
    console.log("WebSocket:", WS_URL);
    console.log("\nListening...\n");

    const web3 = new Web3(WS_URL);
    const contract = new web3.eth.Contract(CONTRACT_ABI, CONTRACT_ADDRESS);

    if (EVENT_NAME) {
        const subscription = contract.events[EVENT_NAME]();

        subscription.on("data", (event) => {
            const timestamp = new Date().toISOString();
            const eventAbi = CONTRACT_ABI.find((a) => a.type === "event" && a.name === EVENT_NAME);
            if (eventAbi) {
                printEvent(eventAbi, event.returnValues, event, timestamp);
            }
        });

        subscription.on("error", (err) => {
            console.error("Subscription error:", err.message);
        });
    } else {
        const subscription = contract.events.allEvents();

        subscription.on("data", (event) => {
            const timestamp = new Date().toISOString();
            const eventAbi = CONTRACT_ABI.find((a) => a.type === "event" && a.name === event.event);

            if (eventAbi) {
                printEvent(eventAbi, event.returnValues, event, timestamp);
            } else {
                printRawLog(event, timestamp);
            }
        });

        subscription.on("error", (err) => {
            console.error("Subscription error:", err.message);
        });
    }

    // Handle WebSocket disconnection by falling back to polling
    web3.currentProvider.on("close", () => {
        console.log("\nWebSocket disconnected. Switching to polling fallback...");
        listenPolling();
    });

    process.once("SIGINT", () => {
        console.log(`\n\nStopping listener. Total events captured: ${eventCount}`);
        web3.currentProvider.disconnect();
        process.exit(0);
    });
}

// ==================== POLLING LISTENER (FALLBACK) ====================
async function listenPolling() {
    console.log("==================== EVENT LISTENER (Polling) ====================");
    console.log("Contract:", CONTRACT_ADDRESS);
    console.log("Filter:", EVENT_NAME || "ALL EVENTS");
    console.log("RPC:", RPC_URL);
    console.log(`Poll interval: ${POLL_INTERVAL_MS / 1000}s`);
    console.log("\nListening...\n");

    const web3 = new Web3(RPC_URL);
    const contract = new web3.eth.Contract(CONTRACT_ABI, CONTRACT_ADDRESS);

    let lastBlock = Number(await web3.eth.getBlockNumber());
    console.log("Starting from block:", lastBlock);

    const eventAbis = CONTRACT_ABI.filter((a) => a.type === "event");

    const poll = async () => {
        try {
            const currentBlock = Number(await web3.eth.getBlockNumber());
            if (currentBlock <= lastBlock) return;

            if (EVENT_NAME) {
                const events = await contract.getPastEvents(EVENT_NAME, {
                    fromBlock: lastBlock + 1,
                    toBlock: currentBlock,
                });

                const eventAbi = eventAbis.find((a) => a.name === EVENT_NAME);
                for (const event of events) {
                    const timestamp = new Date().toISOString();
                    if (eventAbi) {
                        printEvent(eventAbi, event.returnValues, event, timestamp);
                    }
                }
            } else {
                const events = await contract.getPastEvents("allEvents", {
                    fromBlock: lastBlock + 1,
                    toBlock: currentBlock,
                });

                for (const event of events) {
                    const timestamp = new Date().toISOString();
                    const eventAbi = eventAbis.find((a) => a.name === event.event);

                    if (eventAbi) {
                        printEvent(eventAbi, event.returnValues, event, timestamp);
                    } else {
                        printRawLog(event, timestamp);
                    }
                }
            }

            lastBlock = currentBlock;
        } catch (err) {
            console.error("Poll error:", err.message);
        }
    };

    const interval = setInterval(poll, POLL_INTERVAL_MS);

    process.once("SIGINT", () => {
        console.log(`\n\nStopping listener. Total events captured: ${eventCount}`);
        clearInterval(interval);
        process.exit(0);
    });
}

// ==================== ENTRY POINT ====================
(async () => {
    try {
        await listenWebSocket();
    } catch (err) {
        console.log("WebSocket unavailable, falling back to polling...");
        console.log("Reason:", err.message, "\n");
        await listenPolling();
    }
})();
