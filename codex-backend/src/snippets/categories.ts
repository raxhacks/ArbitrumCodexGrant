export const CATEGORIES = [
  "Stylus & DeFi",
  "Timeboost",
  "Arbitrum Infrastructure",
  "Wallet & Signing",
  "Smart Contracts",
  "RPC & Blocks",
] as const;

export type Category = (typeof CATEGORIES)[number];

interface SnippetMeta {
  title: string;
  description: string;
  category: Category;
}

export const SNIPPET_META: Record<string, SnippetMeta> = {
  "001_ARBPriceOracle": {
    title: "ARB Price Oracle",
    description: "Fetch the latest ARB/USD price from Chainlink oracles on Arbitrum One and Sepolia testnet",
    category: "Stylus & DeFi",
  },
  "002_StylusCacheBidSubmit": {
    title: "Stylus Cache Bid Submit",
    description: "Submit a cache bid to keep a Stylus program initialized in the CacheManager",
    category: "Stylus & DeFi",
  },
  "003_StylusCacheRead": {
    title: "Stylus Cache Read",
    description: "Read the current state of the Stylus CacheManager including entries, sizes, and bid info",
    category: "Stylus & DeFi",
  },
  "004_TimeboostFullState": {
    title: "Timeboost Full State",
    description: "Query the full Timeboost ExpressLaneAuction state including config, balances, and event history",
    category: "Timeboost",
  },
  "005_TimeboostCurrentState": {
    title: "Timeboost Current State",
    description: "Get the current Timeboost round info: round number, duration, reserve price, and express lane controller",
    category: "Timeboost",
  },
  "006_TimeboostDetect": {
    title: "Timeboost Detect",
    description: "Detect whether Timeboost is active on a given Arbitrum chain by probing the ExpressLaneAuction contract",
    category: "Timeboost",
  },
  "007_TimeboostAuctionDecode": {
    title: "Timeboost Auction Decode",
    description: "Decode Timeboost auction transactions and extract bid details from calldata",
    category: "Timeboost",
  },
  "008_TimeboostBidSubmit": {
    title: "Timeboost Bid Submit",
    description: "Submit a Timeboost bid with EIP-712 typed data signing for express lane access",
    category: "Timeboost",
  },
  "009_TimeboostWinnerMonitor": {
    title: "Timeboost Winner Monitor",
    description: "Monitor Timeboost auction winners in real-time via WebSocket or polling",
    category: "Timeboost",
  },
  "010_TimeboostOptimalBid": {
    title: "Timeboost Optimal Bid",
    description: "Calculate optimal Timeboost bid strategies using historical auction data and statistical analysis",
    category: "Timeboost",
  },
  "011_TimeboostAuctionHistory": {
    title: "Timeboost Auction History",
    description: "Read historical Timeboost auction results with leaderboards and daily breakdowns",
    category: "Timeboost",
  },
  "012_ArbGasInfo": {
    title: "Arbitrum Gas Info",
    description: "Read the ArbGasInfo precompile for L1/L2 gas pricing, base fees, and cost breakdowns",
    category: "Arbitrum Infrastructure",
  },
  "013_L1ToL2TxStatus": {
    title: "L1 to L2 Transaction Status",
    description: "Track the status of retryable tickets sent from L1 to L2 including redemption status",
    category: "Arbitrum Infrastructure",
  },
  "014_L2ToL1BlockMapping": {
    title: "L2 to L1 Block Mapping",
    description: "Map L2 block numbers to their corresponding L1 blocks using the NodeInterface precompile",
    category: "Arbitrum Infrastructure",
  },
  "015_ArbL2InboxRead": {
    title: "Arbitrum L2 Inbox Read",
    description: "Read delayed inbox messages and sequencer batch data from the Arbitrum inbox contracts",
    category: "Arbitrum Infrastructure",
  },
  "016_GenerateWallet": {
    title: "Generate Wallet",
    description: "Generate a new random wallet with private key, public key, and address",
    category: "Wallet & Signing",
  },
  "017_SignEIP712": {
    title: "Sign EIP-712 Typed Data",
    description: "Sign and verify EIP-712 structured typed data for off-chain signatures",
    category: "Wallet & Signing",
  },
  "018_ReadStorageSlot": {
    title: "Read Storage Slot",
    description: "Read raw storage slots from any contract, including support for mappings and dynamic arrays",
    category: "Smart Contracts",
  },
  "019_VerifyBlockscout": {
    title: "Verify on Blockscout",
    description: "Verify and publish smart contract source code on the Blockscout explorer",
    category: "Smart Contracts",
  },
  "020_ERC20PermitTransfer": {
    title: "ERC-20 Permit Transfer",
    description: "Execute gasless ERC-20 approvals using EIP-2612 permit signatures followed by transferFrom",
    category: "Wallet & Signing",
  },
  "021_WriteSmartContract": {
    title: "Write Smart Contract",
    description: "Send write transactions to smart contracts with gas estimation and simulation",
    category: "Smart Contracts",
  },
  "022_ReadSmartContract": {
    title: "Read Smart Contract",
    description: "Call view/pure functions on smart contracts with support for batch reads",
    category: "Smart Contracts",
  },
  "023_ConnectWallet": {
    title: "Connect Wallet",
    description: "Connect a wallet to an Arbitrum RPC and display network info, balance, and nonce",
    category: "Wallet & Signing",
  },
  "024_InitRPC": {
    title: "Initialize RPC",
    description: "Connect to Arbitrum RPC endpoints with failover, WebSocket support, and latency benchmarking",
    category: "RPC & Blocks",
  },
  "025_GetBlockNumber": {
    title: "Get Block Number",
    description: "Fetch the current block number from the Arbitrum network",
    category: "RPC & Blocks",
  },
  "026_GetBlockInfo": {
    title: "Get Block Info",
    description: "Retrieve full block details including transactions, gas usage, and timestamps",
    category: "RPC & Blocks",
  },
  "027_GetTxByHash": {
    title: "Get Transaction by Hash",
    description: "Look up a transaction by hash and retrieve its receipt, status, and decoded details",
    category: "RPC & Blocks",
  },
  "028_ListenContractEvents": {
    title: "Listen to Contract Events",
    description: "Subscribe to smart contract events in real-time via WebSocket or poll via HTTP",
    category: "Smart Contracts",
  },
  "029_DeployBytecode": {
    title: "Deploy from Bytecode",
    description: "Deploy a smart contract directly from compiled bytecode with constructor arguments",
    category: "Smart Contracts",
  },
};
