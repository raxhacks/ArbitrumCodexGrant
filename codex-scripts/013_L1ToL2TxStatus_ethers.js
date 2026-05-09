const { ethers } = require("ethers");

const L1_RPC_URL = process.env.L1_RPC_URL || "https://ethereum-rpc.publicnode.com";
const L2_RPC_URL = "https://arb1.arbitrum.io/rpc";
const L1_TX_HASH = process.env.L1_TX_HASH || "0x952967337d5b8986bbb6ad2765b3d239471b1a157cf40bb6f26caae81610056e";

const DELAYED_INBOX_ADDRESS = "0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f";  // Arbitrum One Delayed Inbox
const BRIDGE_ADDRESS = "0x8315177aB297bA92A06054cE80a67Ed4DBd7ed3a";         // Arbitrum One Bridge
const ARB_RETRYABLE_TX_ADDRESS = "0x000000000000000000000000000000000000006E"; // ArbRetryableTx precompile

const BRIDGE_ABI = [
    "event MessageDelivered(uint256 indexed messageIndex, bytes32 indexed beforeInboxAcc, address inbox, uint8 kind, address sender, bytes32 messageDataHash, uint256 baseFeeL1, uint64 timestamp)",
];

const INBOX_ABI = [
    "event InboxMessageDelivered(uint256 indexed messageNum, bytes data)",
    "event InboxMessageDeliveredFromOrigin(uint256 indexed messageNum)",
];

const ARB_RETRYABLE_TX_ABI = [
    "event TicketCreated(bytes32 indexed ticketId)",
    "event RedeemScheduled(bytes32 indexed ticketId, bytes32 indexed retryTxHash, uint64 indexed sequenceNum, uint64 donatedGas, address gasDonor, uint256 maxRefund, uint256 submissionFeeRefund)",
    "event Redeemed(bytes32 indexed userTxHash)",
    "event LifetimeExtended(bytes32 indexed ticketId, uint256 newTimeout)",
    "event Canceled(bytes32 indexed ticketId)",
    "function getTimeout(bytes32 ticketId) external view returns (uint256)",
    "function getBeneficiary(bytes32 ticketId) external view returns (address)",
    "function getLifetime() external view returns (uint256)",
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
    const l1Provider = new ethers.JsonRpcProvider(L1_RPC_URL);
    const l2Provider = new ethers.JsonRpcProvider(L2_RPC_URL);

    // Step 1: Fetch L1 transaction
    console.log("L1 TRANSACTION");
    const l1Tx = await l1Provider.getTransaction(L1_TX_HASH);
    if (!l1Tx) {
        console.log("Status:", STATUS.NOT_FOUND);
        console.log("L1 transaction not found:", L1_TX_HASH);
        return;
    }

    console.log("Hash:", l1Tx.hash);
    console.log("From:", l1Tx.from);
    console.log("To:", l1Tx.to);
    console.log("Value:", ethers.formatEther(l1Tx.value), "ETH");
    console.log("Block:", l1Tx.blockNumber || "PENDING");

    if (!l1Tx.blockNumber) {
        console.log("\nStatus:", STATUS.L1_PENDING);
        console.log("Transaction is still pending on L1.");
        return;
    }

    // Step 2: Check L1 receipt
    console.log("\nL1 RECEIPT");
    const l1Receipt = await l1Provider.getTransactionReceipt(L1_TX_HASH);
    if (!l1Receipt) {
        console.log("Status:", STATUS.L1_PENDING);
        return;
    }

    console.log("Status:", l1Receipt.status === 1 ? "SUCCESS" : "REVERTED");
    console.log("Gas used:", l1Receipt.gasUsed.toString());
    console.log("Block:", l1Receipt.blockNumber);

    if (l1Receipt.status !== 1) {
        console.log("\nL1 transaction reverted. No L2 message will be created.");
        console.log("Status:", STATUS.L2_FAILED);
        return;
    }

    // Step 3: Parse bridge MessageDelivered events
    console.log("\nBRIDGE MESSAGES");
    const bridgeIface = new ethers.Interface(BRIDGE_ABI);
    const inboxIface = new ethers.Interface(INBOX_ABI);

    let messageIndices = [];
    for (const log of l1Receipt.logs) {
        try {
            const parsed = bridgeIface.parseLog({ topics: log.topics, data: log.data });
            if (parsed && parsed.name === "MessageDelivered") {
                const msgIndex = parsed.args.messageIndex;
                messageIndices.push(msgIndex);
                console.log(`Message ${msgIndex.toString()}:`);
                console.log("  Sender:", parsed.args.sender);
                console.log("  Kind:", parsed.args.kind.toString());
                console.log("  L1 base fee:", ethers.formatUnits(parsed.args.baseFeeL1, "gwei"), "gwei");
                console.log("  Timestamp:", new Date(Number(parsed.args.timestamp) * 1000).toISOString());
            }
        } catch {}
    }

    // Parse InboxMessageDelivered events
    let inboxMessages = [];
    for (const log of l1Receipt.logs) {
        try {
            const parsed = inboxIface.parseLog({ topics: log.topics, data: log.data });
            if (parsed && (parsed.name === "InboxMessageDelivered" || parsed.name === "InboxMessageDeliveredFromOrigin")) {
                inboxMessages.push(parsed.args.messageNum);
                console.log(`Inbox message delivered: ${parsed.args.messageNum.toString()}`);
            }
        } catch {}
    }

    if (messageIndices.length === 0 && inboxMessages.length === 0) {
        console.log("No cross-chain messages found in this transaction.");
        console.log("This may not be an L1-to-L2 transaction.");
        console.log("Status:", STATUS.L1_CONFIRMED);
        return;
    }

    // Step 4: Compute retryable ticket ID
    // The retryable ticket ID is derived from the L1 tx and message number
    console.log("\nL2 RETRYABLE TICKET");

    // Search for retryable ticket events on L2
    const retryableIface = new ethers.Interface(ARB_RETRYABLE_TX_ABI);
    const retryable = new ethers.Contract(ARB_RETRYABLE_TX_ADDRESS, ARB_RETRYABLE_TX_ABI, l2Provider);
    const lifetime = await retryable.getLifetime();
    console.log("Retryable ticket lifetime:", (Number(lifetime) / 86400).toFixed(1), "days");

    // NOTE: Retryable ticket IDs are computed internally by Arbitrum from the full
    // message data (not just the L1 tx hash). For precise tracking, use the Arbitrum SDK
    // (@arbitrum/sdk L1TransactionReceipt.getL1ToL2Messages()). Here we search by event.
    const l1Block = await l1Provider.getBlock(l1Receipt.blockNumber);
    const l1Timestamp = l1Block.timestamp;
    const currentL2Block = await l2Provider.getBlockNumber();

    // Estimate L2 block range from L1 timestamp (~0.25s per L2 block)
    const blocksPerHour = 14400;
    const searchRangeHours = 48;
    const estimatedStartBlock = Math.max(0, currentL2Block - blocksPerHour * searchRangeHours);

    console.log("Searching L2 for retryable tickets...");
    console.log("L1 timestamp:", new Date(Number(l1Timestamp) * 1000).toISOString());
    console.log("Search range: block", estimatedStartBlock, "to", currentL2Block);

    // Search for TicketCreated events on L2 in the estimated block range
    const ticketFilter = retryable.filters.TicketCreated();
    let ticketEvents;
    try {
        ticketEvents = await retryable.queryFilter(ticketFilter, estimatedStartBlock, currentL2Block);
    } catch {
        ticketEvents = [];
        console.log("Warning: Could not query TicketCreated events (range may be too large)");
    }
    console.log("TicketCreated events in range:", ticketEvents.length);

    // Check each ticket's status
    const l2TxSearchResults = [];
    for (const event of ticketEvents) {
        const ticketId = event.args.ticketId;
        try {
            const timeout = await retryable.getTimeout(ticketId);
            const beneficiary = await retryable.getBeneficiary(ticketId);
            const now = Math.floor(Date.now() / 1000);
            const isExpired = Number(timeout) < now;

            l2TxSearchResults.push({
                ticketId,
                timeout: Number(timeout),
                beneficiary,
                expired: isExpired,
                block: event.blockNumber,
                tx: event.transactionHash,
            });
        } catch {
            // getTimeout reverts for redeemed or non-existent tickets
            l2TxSearchResults.push({
                ticketId,
                redeemed: true,
                block: event.blockNumber,
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
