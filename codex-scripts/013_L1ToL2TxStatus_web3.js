const { Web3 } = require("web3");

const L1_RPC_URL = process.env.L1_RPC_URL || "https://ethereum-rpc.publicnode.com";
const L2_RPC_URL = "https://arb1.arbitrum.io/rpc";
const L1_TX_HASH = process.env.L1_TX_HASH || "0x952967337d5b8986bbb6ad2765b3d239471b1a157cf40bb6f26caae81610056e";

const DELAYED_INBOX_ADDRESS = "0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f";
const BRIDGE_ADDRESS = "0x8315177aB297bA92A06054cE80a67Ed4DBd7ed3a";
const ARB_RETRYABLE_TX_ADDRESS = "0x000000000000000000000000000000000000006E";

const BRIDGE_ABI = [
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

const INBOX_ABI = [
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

const ARB_RETRYABLE_TX_ABI = [
    {
        name: "TicketCreated",
        type: "event",
        inputs: [
            { name: "ticketId", type: "bytes32", indexed: true },
        ],
    },
    {
        name: "RedeemScheduled",
        type: "event",
        inputs: [
            { name: "ticketId", type: "bytes32", indexed: true },
            { name: "retryTxHash", type: "bytes32", indexed: true },
            { name: "sequenceNum", type: "uint64", indexed: true },
            { name: "donatedGas", type: "uint64", indexed: false },
            { name: "gasDonor", type: "address", indexed: false },
            { name: "maxRefund", type: "uint256", indexed: false },
            { name: "submissionFeeRefund", type: "uint256", indexed: false },
        ],
    },
    {
        name: "Redeemed",
        type: "event",
        inputs: [
            { name: "userTxHash", type: "bytes32", indexed: true },
        ],
    },
    {
        name: "getTimeout",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "ticketId", type: "bytes32" }],
        outputs: [{ name: "", type: "uint256" }],
    },
    {
        name: "getBeneficiary",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "ticketId", type: "bytes32" }],
        outputs: [{ name: "", type: "address" }],
    },
    {
        name: "getLifetime",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
    },
];

const STATUS = {
    NOT_FOUND: "NOT_FOUND",
    L1_PENDING: "L1_PENDING",
    L1_CONFIRMED: "L1_CONFIRMED",
    L2_TICKET_CREATED: "L2_TICKET_CREATED",
    L2_REDEEMED: "L2_REDEEMED",
    L2_FAILED: "L2_FAILED",
    EXPIRED: "EXPIRED",
};

async function detectL1ToL2Status() {
    const l1Web3 = new Web3(L1_RPC_URL);
    const l2Web3 = new Web3(L2_RPC_URL);

    // Step 1: Fetch L1 transaction
    console.log("L1 TRANSACTION");
    const l1Tx = await l1Web3.eth.getTransaction(L1_TX_HASH);
    if (!l1Tx) {
        console.log("Status:", STATUS.NOT_FOUND);
        console.log("L1 transaction not found:", L1_TX_HASH);
        return;
    }

    console.log("Hash:", l1Tx.hash);
    console.log("From:", l1Tx.from);
    console.log("To:", l1Tx.to);
    console.log("Value:", Web3.utils.fromWei(l1Tx.value, "ether"), "ETH");
    console.log("Block:", l1Tx.blockNumber ? l1Tx.blockNumber.toString() : "PENDING");

    if (!l1Tx.blockNumber) {
        console.log("\nStatus:", STATUS.L1_PENDING);
        console.log("Transaction is still pending on L1.");
        return;
    }

    // Step 2: Check L1 receipt
    console.log("\nL1 RECEIPT");
    const l1Receipt = await l1Web3.eth.getTransactionReceipt(L1_TX_HASH);
    if (!l1Receipt) {
        console.log("Status:", STATUS.L1_PENDING);
        return;
    }

    console.log("Status:", l1Receipt.status ? "SUCCESS" : "REVERTED");
    console.log("Gas used:", l1Receipt.gasUsed.toString());
    console.log("Block:", l1Receipt.blockNumber.toString());

    if (!l1Receipt.status) {
        console.log("\nL1 transaction reverted. No L2 message will be created.");
        console.log("Status:", STATUS.L2_FAILED);
        return;
    }

    // Step 3: Parse bridge MessageDelivered events
    console.log("\nBRIDGE MESSAGES");
    const bridgeContract = new l1Web3.eth.Contract(BRIDGE_ABI, BRIDGE_ADDRESS);
    const inboxContract = new l1Web3.eth.Contract(INBOX_ABI, DELAYED_INBOX_ADDRESS);

    // Decode MessageDelivered from receipt logs
    let messageIndices = [];
    const msgDeliveredSig = l1Web3.eth.abi.encodeEventSignature(BRIDGE_ABI[0]);
    const inboxMsgSig = l1Web3.eth.abi.encodeEventSignature(INBOX_ABI[0]);
    const inboxOriginSig = l1Web3.eth.abi.encodeEventSignature(INBOX_ABI[1]);

    for (const log of l1Receipt.logs) {
        if (log.topics[0] === msgDeliveredSig) {
            const msgIndex = l1Web3.eth.abi.decodeParameter("uint256", log.topics[1]);
            const nonIndexed = l1Web3.eth.abi.decodeParameters(
                ["address", "uint8", "address", "bytes32", "uint256", "uint64"],
                log.data
            );
            messageIndices.push(BigInt(msgIndex));
            console.log(`Message ${msgIndex.toString()}:`);
            console.log("  Sender:", nonIndexed[2]);
            console.log("  Kind:", nonIndexed[1].toString());
            console.log("  L1 base fee:", Web3.utils.fromWei(nonIndexed[4].toString(), "gwei"), "gwei");
            console.log("  Timestamp:", new Date(Number(nonIndexed[5]) * 1000).toISOString());
        }

        if (log.topics[0] === inboxMsgSig || log.topics[0] === inboxOriginSig) {
            const messageNum = l1Web3.eth.abi.decodeParameter("uint256", log.topics[1]);
            console.log(`Inbox message delivered: ${messageNum.toString()}`);
        }
    }

    if (messageIndices.length === 0) {
        console.log("No cross-chain messages found in this transaction.");
        console.log("This may not be an L1-to-L2 transaction.");
        console.log("Status:", STATUS.L1_CONFIRMED);
        return;
    }

    // Step 4: Check retryable ticket on L2
    // NOTE: Retryable ticket IDs are computed internally by Arbitrum from the full
    // message data, not from a simple hash. For precise tracking, use the Arbitrum SDK.
    console.log("\nL2 RETRYABLE TICKET");
    const retryable = new l2Web3.eth.Contract(ARB_RETRYABLE_TX_ABI, ARB_RETRYABLE_TX_ADDRESS);
    const lifetime = await retryable.methods.getLifetime().call();
    console.log("Retryable ticket lifetime:", (Number(lifetime) / 86400).toFixed(1), "days");

    const l1Block = await l1Web3.eth.getBlock(Number(l1Receipt.blockNumber));
    const l1Timestamp = Number(l1Block.timestamp);
    console.log("L1 timestamp:", new Date(l1Timestamp * 1000).toISOString());

    // Search for TicketCreated events on L2 in a time-estimated block range
    const currentL2Block = Number(await l2Web3.eth.getBlockNumber());
    const blocksPerHour = 14400; // ~0.25s per L2 block
    const estimatedStartBlock = Math.max(0, currentL2Block - blocksPerHour * 48);

    console.log("Searching L2 for retryable tickets...");
    console.log("Search range: block", estimatedStartBlock, "to", currentL2Block);

    let ticketEvents;
    try {
        ticketEvents = await retryable.getPastEvents("TicketCreated", {
            fromBlock: estimatedStartBlock,
            toBlock: "latest",
        });
    } catch {
        ticketEvents = [];
        console.log("Warning: Could not query TicketCreated events (range may be too large)");
    }
    console.log("TicketCreated events in range:", ticketEvents.length);

    const l2TxSearchResults = [];
    for (const event of ticketEvents) {
        const ticketId = event.returnValues.ticketId;
        try {
            const timeout = await retryable.methods.getTimeout(ticketId).call();
            const beneficiary = await retryable.methods.getBeneficiary(ticketId).call();
            const now = Math.floor(Date.now() / 1000);
            const isExpired = Number(timeout) < now;

            l2TxSearchResults.push({
                ticketId,
                timeout: Number(timeout),
                beneficiary,
                expired: isExpired,
                block: Number(event.blockNumber),
                tx: event.transactionHash,
            });
        } catch {
            l2TxSearchResults.push({
                ticketId,
                redeemed: true,
                block: Number(event.blockNumber),
                tx: event.transactionHash,
            });
        }
    }

    // Step 5: Determine final status
    console.log("\nFINAL STATUS");

    if (l2TxSearchResults.length === 0) {
        console.log("No retryable tickets found in the search range.");
        console.log("The message may still be in transit.");
        console.log("For precise tracking, use the Arbitrum SDK (@arbitrum/sdk).");
        console.log("Status:", STATUS.L1_CONFIRMED);
        return;
    }

    for (const result of l2TxSearchResults) {
        console.log(`\nTicket: ${result.ticketId}`);
        console.log("L2 block:", result.block, "| Tx:", result.tx);
        if (result.redeemed) {
            console.log("Status: REDEEMED or EXPIRED (ticket no longer active)");
        } else if (result.expired) {
            console.log("Status:", STATUS.EXPIRED);
            console.log("The retryable ticket has expired.");
            console.log("Timeout was:", new Date(result.timeout * 1000).toISOString());
        } else {
            console.log("Status:", STATUS.L2_TICKET_CREATED);
            console.log("The retryable ticket is pending redemption.");
            console.log("Expires:", new Date(result.timeout * 1000).toISOString());
            console.log("Beneficiary:", result.beneficiary);
        }
    }
}

detectL1ToL2Status().catch((err) => {
    console.error("Error detecting L1->L2 status:", err.message);
    process.exit(1);
});
