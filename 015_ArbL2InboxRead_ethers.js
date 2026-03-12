const { ethers } = require("ethers");

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
    "function delayedMessageCount() external view returns (uint256)",
    "function sequencerMessageCount() external view returns (uint256)",
    "function sequencerInbox() external view returns (address)",
    "function delayedInboxAccs(uint256 index) external view returns (bytes32)",
    "function sequencerInboxAccs(uint256 index) external view returns (bytes32)",
    "event MessageDelivered(uint256 indexed messageIndex, bytes32 indexed beforeInboxAcc, address inbox, uint8 kind, address sender, bytes32 messageDataHash, uint256 baseFeeL1, uint64 timestamp)",
];

const DELAYED_INBOX_ABI = [
    "function bridge() external view returns (address)",
    "function sequencerInbox() external view returns (address)",
    "function pauseNewMessages() external view returns (bool)",
    "function allowListEnabled() external view returns (bool)",
    "function isAllowed(address addr) external view returns (bool)",
    "event InboxMessageDelivered(uint256 indexed messageNum, bytes data)",
    "event InboxMessageDeliveredFromOrigin(uint256 indexed messageNum)",
];

const SEQUENCER_INBOX_ABI = [
    "function batchCount() external view returns (uint256)",
    "function totalDelayedMessagesRead() external view returns (uint256)",
    "function bridge() external view returns (address)",
    "function maxTimeVariation() external view returns (uint256 delayBlocks, uint256 futureBlocks, uint256 delaySeconds, uint256 futureSeconds)",
    "function isBatchPoster(address addr) external view returns (bool)",
    "function isSequencer(address addr) external view returns (bool)",
    "event SequencerBatchDelivered(uint256 indexed batchSequenceNumber, bytes32 indexed beforeAcc, bytes32 indexed afterAcc, bytes32 delayedAcc, uint256 afterDelayedMessagesRead, tuple(uint64 minTimestamp, uint64 maxTimestamp, uint64 minBlockNumber, uint64 maxBlockNumber) timeBounds, uint8 dataLocation)",
    "event SequencerBatchData(uint256 indexed batchSequenceNumber, bytes data)",
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

// ==================== MAIN ====================
async function readL2Inbox() {
    const l1Provider = new ethers.JsonRpcProvider(L1_RPC_URL);

    // Auto-calculate start block if FROM_BLOCK is 0 (L1 RPCs limit log query range)
    if (FROM_BLOCK === 0) {
        const currentBlock = await l1Provider.getBlockNumber();
        FROM_BLOCK = Math.max(0, currentBlock - 50_000); // ~1 week of L1 blocks
    }

    const bridge = new ethers.Contract(BRIDGE_ADDRESS, BRIDGE_ABI, l1Provider);
    const delayedInbox = new ethers.Contract(DELAYED_INBOX_ADDRESS, DELAYED_INBOX_ABI, l1Provider);
    const sequencerInbox = new ethers.Contract(SEQUENCER_INBOX_ADDRESS, SEQUENCER_INBOX_ABI, l1Provider);

    // Inbox state
    console.log("==================== INBOX STATE ====================");
    const delayedCount = await bridge.delayedMessageCount();
    const sequencerCount = await bridge.sequencerMessageCount();
    const batchCount = await sequencerInbox.batchCount();
    const delayedRead = await sequencerInbox.totalDelayedMessagesRead();
    const timeVariation = await sequencerInbox.maxTimeVariation();

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
    const bridgeAddr = await delayedInbox.bridge();
    const seqInboxAddr = await delayedInbox.sequencerInbox();

    console.log("Bridge:", bridgeAddr);
    console.log("Sequencer inbox:", seqInboxAddr);

    try {
        const paused = await delayedInbox.pauseNewMessages();
        console.log("Paused:", paused);
    } catch {
        console.log("Paused: N/A");
    }

    try {
        const allowListEnabled = await delayedInbox.allowListEnabled();
        console.log("Allow list enabled:", allowListEnabled);
    } catch {
        console.log("Allow list enabled: N/A");
    }

    // Recent delayed messages (MessageDelivered events)
    console.log("\n==================== RECENT DELAYED MESSAGES ====================");
    const msgFilter = bridge.filters.MessageDelivered();
    const msgEvents = await bridge.queryFilter(msgFilter, FROM_BLOCK, TO_BLOCK);
    const recentMsgs = msgEvents.slice(-MAX_EVENTS);

    console.log("Total delayed messages found:", msgEvents.length);
    console.log(`Showing last ${recentMsgs.length}:\n`);

    recentMsgs.forEach((event, index) => {
        const kind = Number(event.args.kind);
        const kindName = MESSAGE_KINDS[kind] || `Unknown(${kind})`;

        console.log(`--- Message ${event.args.messageIndex.toString()} ---`);
        console.log("  Kind:", kindName);
        console.log("  Sender:", event.args.sender);
        console.log("  Inbox:", event.args.inbox);
        console.log("  L1 base fee:", ethers.formatUnits(event.args.baseFeeL1, "gwei"), "gwei");
        console.log("  Timestamp:", new Date(Number(event.args.timestamp) * 1000).toISOString());
        console.log("  Data hash:", event.args.messageDataHash);
        console.log("  Block:", event.blockNumber);
        console.log("  Tx:", event.transactionHash);
        console.log("");
    });

    // Recent sequencer batches
    console.log("==================== RECENT SEQUENCER BATCHES ====================");
    const batchFilter = sequencerInbox.filters.SequencerBatchDelivered();
    const batchEvents = await sequencerInbox.queryFilter(batchFilter, FROM_BLOCK, TO_BLOCK);
    const recentBatches = batchEvents.slice(-MAX_EVENTS);

    console.log("Total batches found:", batchEvents.length);
    console.log(`Showing last ${recentBatches.length}:\n`);

    const DATA_LOCATIONS = {
        0: "TxInput",
        1: "SeparateBatchEvent",
        2: "NoData",
        3: "Blob",
    };

    recentBatches.forEach((event) => {
        const dataLoc = Number(event.args.dataLocation);

        console.log(`--- Batch ${event.args.batchSequenceNumber.toString()} ---`);
        console.log("  Before acc:", event.args.beforeAcc);
        console.log("  After acc:", event.args.afterAcc);
        console.log("  Delayed acc:", event.args.delayedAcc);
        console.log("  After delayed msgs read:", event.args.afterDelayedMessagesRead.toString());
        console.log("  Data location:", DATA_LOCATIONS[dataLoc] || `Unknown(${dataLoc})`);
        console.log("  Time bounds:", {
            minTimestamp: new Date(Number(event.args.timeBounds.minTimestamp) * 1000).toISOString(),
            maxTimestamp: new Date(Number(event.args.timeBounds.maxTimestamp) * 1000).toISOString(),
            minBlock: event.args.timeBounds.minBlockNumber.toString(),
            maxBlock: event.args.timeBounds.maxBlockNumber.toString(),
        });
        console.log("  Block:", event.blockNumber);
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
