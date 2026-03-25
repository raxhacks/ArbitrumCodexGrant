const { Web3 } = require("web3");

// ==================== CONFIGURATION ====================
const L1_RPC_URL = "https://eth.llamarpc.com";
const L2_RPC_URL = "https://arb1.arbitrum.io/rpc";
let FROM_BLOCK = 0;         // L1 block to start from (0 = auto-calculate recent range)
const TO_BLOCK = "latest";
const MAX_EVENTS = 100;     // Max events to display

// ==================== CONTRACT ADDRESSES ====================
const DELAYED_INBOX_ADDRESS = "0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f";
const SEQUENCER_INBOX_ADDRESS = "0x1c479675ad559DC151F6Ec7ed3FbF8ceE79582B6";
const BRIDGE_ADDRESS = "0x8315177aB297bA92A06054cE80a67Ed4DBd7ed3a";

// ==================== ABI ====================
const BRIDGE_ABI = [
    {
        name: "delayedMessageCount",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
    },
    {
        name: "sequencerMessageCount",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
    },
    {
        name: "sequencerInbox",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "address" }],
    },
    {
        name: "delayedInboxAccs",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "index", type: "uint256" }],
        outputs: [{ name: "", type: "bytes32" }],
    },
    {
        name: "sequencerInboxAccs",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "index", type: "uint256" }],
        outputs: [{ name: "", type: "bytes32" }],
    },
    {
        name: "MessageDelivered",
        type: "event",
        inputs: [
            { name: "messageIndex", type: "uint256", indexed: true },
            { name: "beforeInboxAcc", type: "bytes32", indexed: true },
            { name: "inbox", type: "address", indexed: false },
            { name: "kind", type: "uint8", indexed: false },
            { name: "sender", type: "address", indexed: false },
            { name: "messageDataHash", type: "bytes32", indexed: false },
            { name: "baseFeeL1", type: "uint256", indexed: false },
            { name: "timestamp", type: "uint64", indexed: false },
        ],
    },
];

const DELAYED_INBOX_ABI = [
    {
        name: "bridge",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "address" }],
    },
    {
        name: "sequencerInbox",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "address" }],
    },
    {
        name: "pauseNewMessages",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "bool" }],
    },
    {
        name: "allowListEnabled",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "bool" }],
    },
    {
        name: "InboxMessageDelivered",
        type: "event",
        inputs: [
            { name: "messageNum", type: "uint256", indexed: true },
            { name: "data", type: "bytes", indexed: false },
        ],
    },
    {
        name: "InboxMessageDeliveredFromOrigin",
        type: "event",
        inputs: [
            { name: "messageNum", type: "uint256", indexed: true },
        ],
    },
];

const SEQUENCER_INBOX_ABI = [
    {
        name: "batchCount",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
    },
    {
        name: "totalDelayedMessagesRead",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
    },
    {
        name: "bridge",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "address" }],
    },
    {
        name: "maxTimeVariation",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [
            { name: "delayBlocks", type: "uint256" },
            { name: "futureBlocks", type: "uint256" },
            { name: "delaySeconds", type: "uint256" },
            { name: "futureSeconds", type: "uint256" },
        ],
    },
    {
        name: "SequencerBatchDelivered",
        type: "event",
        inputs: [
            { name: "batchSequenceNumber", type: "uint256", indexed: true },
            { name: "beforeAcc", type: "bytes32", indexed: true },
            { name: "afterAcc", type: "bytes32", indexed: true },
            { name: "delayedAcc", type: "bytes32", indexed: false },
            { name: "afterDelayedMessagesRead", type: "uint256", indexed: false },
            {
                name: "timeBounds",
                type: "tuple",
                indexed: false,
                components: [
                    { name: "minTimestamp", type: "uint64" },
                    { name: "maxTimestamp", type: "uint64" },
                    { name: "minBlockNumber", type: "uint64" },
                    { name: "maxBlockNumber", type: "uint64" },
                ],
            },
            { name: "dataLocation", type: "uint8", indexed: false },
        ],
    },
];

// ==================== MESSAGE KINDS ====================
const MESSAGE_KINDS = {
    0: "L1MessageType_ethDeposit",
    3: "L1MessageType_submitRetryableTx",
    6: "L1MessageType_batchPostingReport",
    7: "L1MessageType_L2FundedByL1",
    8: "L1MessageType_rollupEvent",
    9: "L1MessageType_submitRetryableAutoRedeem",
    12: "L1MessageType_L2MessageFromOrigin",
};

const DATA_LOCATIONS = {
    0: "TxInput",
    1: "SeparateBatchEvent",
    2: "NoData",
    3: "Blob",
};

// ==================== MAIN ====================
async function readL2Inbox() {
    const l1Web3 = new Web3(L1_RPC_URL);

    // Auto-calculate start block if FROM_BLOCK is 0 (L1 RPCs limit log query range)
    if (FROM_BLOCK === 0) {
        const currentBlock = Number(await l1Web3.eth.getBlockNumber());
        FROM_BLOCK = Math.max(0, currentBlock - 50_000); // ~1 week of L1 blocks
    }

    const bridge = new l1Web3.eth.Contract(BRIDGE_ABI, BRIDGE_ADDRESS);
    const delayedInbox = new l1Web3.eth.Contract(DELAYED_INBOX_ABI, DELAYED_INBOX_ADDRESS);
    const sequencerInbox = new l1Web3.eth.Contract(SEQUENCER_INBOX_ABI, SEQUENCER_INBOX_ADDRESS);

    const fmtGwei = (val) => Web3.utils.fromWei(val.toString(), "gwei");

    // Inbox state
    console.log("==================== INBOX STATE ====================");
    const delayedCount = await bridge.methods.delayedMessageCount().call();
    const sequencerCount = await bridge.methods.sequencerMessageCount().call();
    const batchCount = await sequencerInbox.methods.batchCount().call();
    const delayedRead = await sequencerInbox.methods.totalDelayedMessagesRead().call();
    const timeVariation = await sequencerInbox.methods.maxTimeVariation().call();

    console.log("Delayed message count:", delayedCount.toString());
    console.log("Sequencer message count:", sequencerCount.toString());
    console.log("Batch count:", batchCount.toString());
    console.log("Delayed messages read by sequencer:", delayedRead.toString());
    console.log("Unread delayed messages:", (BigInt(delayedCount) - BigInt(delayedRead)).toString());

    console.log("\n==================== TIME VARIATION ====================");
    console.log("Delay blocks:", timeVariation.delayBlocks.toString());
    console.log("Future blocks:", timeVariation.futureBlocks.toString());
    console.log("Delay seconds:", timeVariation.delaySeconds.toString());
    console.log("Future seconds:", timeVariation.futureSeconds.toString());

    // Delayed inbox config
    console.log("\n==================== DELAYED INBOX CONFIG ====================");
    const bridgeAddr = await delayedInbox.methods.bridge().call();
    const seqInboxAddr = await delayedInbox.methods.sequencerInbox().call();

    console.log("Bridge:", bridgeAddr);
    console.log("Sequencer inbox:", seqInboxAddr);

    try {
        const paused = await delayedInbox.methods.pauseNewMessages().call();
        console.log("Paused:", paused);
    } catch {
        console.log("Paused: N/A");
    }

    try {
        const allowListEnabled = await delayedInbox.methods.allowListEnabled().call();
        console.log("Allow list enabled:", allowListEnabled);
    } catch {
        console.log("Allow list enabled: N/A");
    }

    // Recent delayed messages
    console.log("\n==================== RECENT DELAYED MESSAGES ====================");
    const msgEvents = await bridge.getPastEvents("MessageDelivered", { fromBlock: FROM_BLOCK, toBlock: TO_BLOCK });
    const recentMsgs = msgEvents.slice(-MAX_EVENTS);

    console.log("Total delayed messages found:", msgEvents.length);
    console.log(`Showing last ${recentMsgs.length}:\n`);

    recentMsgs.forEach((event) => {
        const { messageIndex, inbox, kind, sender, messageDataHash, baseFeeL1, timestamp } = event.returnValues;
        const kindNum = Number(kind);
        const kindName = MESSAGE_KINDS[kindNum] || `Unknown(${kindNum})`;

        console.log(`--- Message ${messageIndex.toString()} ---`);
        console.log("  Kind:", kindName);
        console.log("  Sender:", sender);
        console.log("  Inbox:", inbox);
        console.log("  L1 base fee:", fmtGwei(baseFeeL1), "gwei");
        console.log("  Timestamp:", new Date(Number(timestamp) * 1000).toISOString());
        console.log("  Data hash:", messageDataHash);
        console.log("  Block:", event.blockNumber.toString());
        console.log("  Tx:", event.transactionHash);
        console.log("");
    });

    // Recent sequencer batches
    console.log("==================== RECENT SEQUENCER BATCHES ====================");
    const batchEvents = await sequencerInbox.getPastEvents("SequencerBatchDelivered", { fromBlock: FROM_BLOCK, toBlock: TO_BLOCK });
    const recentBatches = batchEvents.slice(-MAX_EVENTS);

    console.log("Total batches found:", batchEvents.length);
    console.log(`Showing last ${recentBatches.length}:\n`);

    recentBatches.forEach((event) => {
        const { batchSequenceNumber, beforeAcc, afterAcc, delayedAcc, afterDelayedMessagesRead, timeBounds, dataLocation } = event.returnValues;
        const dataLoc = Number(dataLocation);

        console.log(`--- Batch ${batchSequenceNumber.toString()} ---`);
        console.log("  Before acc:", beforeAcc);
        console.log("  After acc:", afterAcc);
        console.log("  Delayed acc:", delayedAcc);
        console.log("  After delayed msgs read:", afterDelayedMessagesRead.toString());
        console.log("  Data location:", DATA_LOCATIONS[dataLoc] || `Unknown(${dataLoc})`);
        console.log("  Time bounds:", {
            minTimestamp: new Date(Number(timeBounds.minTimestamp) * 1000).toISOString(),
            maxTimestamp: new Date(Number(timeBounds.maxTimestamp) * 1000).toISOString(),
            minBlock: timeBounds.minBlockNumber.toString(),
            maxBlock: timeBounds.maxBlockNumber.toString(),
        });
        console.log("  Block:", event.blockNumber.toString());
        console.log("  Tx:", event.transactionHash);
        console.log("");
    });

    // Summary
    console.log("==================== SUMMARY ====================");
    console.log("Delayed inbox:", DELAYED_INBOX_ADDRESS);
    console.log("Sequencer inbox:", SEQUENCER_INBOX_ADDRESS);
    console.log("Bridge:", BRIDGE_ADDRESS);
    console.log("Total delayed messages:", delayedCount.toString());
    console.log("Total sequencer batches:", batchCount.toString());
    console.log("Pending delayed messages:", (BigInt(delayedCount) - BigInt(delayedRead)).toString());
}

readL2Inbox().catch((err) => {
    console.error("Error reading L2 inbox:", err.message);
    process.exit(1);
});
