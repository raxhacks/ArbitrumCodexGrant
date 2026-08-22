# Integration Guide

How to take a snippet from the catalog and make it part of your own application.

## The shape of every snippet

Snippets are written as standalone CommonJS scripts so they run with `node` and nothing else. The structure is always the same:

```js
const { ethers } = require("ethers");        // 1. dependency

const RPC_URL = "https://arb1.arbitrum.io/rpc";       // 2. configuration block
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "0x912CE59…";

const CONTRACT_ABI = [ /* … */ ];             // 3. ABI

async function readContract() { /* … */ }     // 4. the actual logic

readContract().catch((err) => {               // 5. entry point + error handling
    console.error("Error:", err.message);
    process.exit(1);
});
```

Integrating means keeping part 4, replacing parts 2 and 5 with your application's configuration and error handling, and converting the module syntax if your project uses ESM.

## Step 1 — install the library

```bash
npm install ethers      # v6, for _ethers.js snippets
# or
npm install web3        # v4, for _web3.js snippets
```

Pick the variant matching what your project already uses. The two variants of a snippet do the same thing and log comparable output — there is no reason to add a second library.

## Step 2 — convert to your module system

Snippets use `require` so they run unmodified on any Node.js 20+ install. For an ESM project (`"type": "module"`, or TypeScript with ES modules):

```js
// snippet
const { ethers } = require("ethers");
const { Web3 } = require("web3");

// ESM
import { ethers } from "ethers";
import { Web3 } from "web3";
```

Nothing else in the snippets depends on CommonJS.

## Step 3 — lift configuration out of the file

The configuration block at the top is there so the file is runnable on its own. In an application, that block is your config layer:

```js
// snippet
const RPC_URL = "https://arb1.arbitrum.io/rpc";
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "0x912CE59…";

// your application
import { config } from "./config.js";
const provider = new ethers.JsonRpcProvider(config.arbitrumRpcUrl);
```

Two things worth carrying over rather than discarding:

- **The default value pattern.** `process.env.X || fallback` is what makes a snippet demonstrable. Keep the environment variable, drop the fallback, and fail loudly at startup if it is missing.
- **The dry-run flag.** `const DRY_RUN = process.env.DRY_RUN !== "false"` — defaulting to safe and requiring an explicit opt-in to broadcast is a good default in production too, especially in scripts run by hand.

## Step 4 — turn the entry point into an export

Replace the self-invoking call and `process.exit` with a normal export, and let errors propagate to your caller:

```js
// snippet
async function readContract() { /* … */ }
readContract().catch((err) => {
    console.error("Error:", err.message);
    process.exit(1);
});

// your application
export async function readContract(provider, address) {
    const contract = new ethers.Contract(address, CONTRACT_ABI, provider);
    return contract.balanceOf(address);
}
```

`process.exit(1)` inside a library kills your server. It exists in the snippets because a script needs a non-zero exit code.

## Step 5 — replace console output with return values

Snippets log because that is their output channel. Your application almost certainly wants the values:

```js
// snippet
console.log("Cache size:", cacheSize.toString(), "bytes");
console.log("Queue size:", queueSize.toString());

// your application
return { cacheSizeBytes: cacheSize, queueSize };
```

Keep `BigInt` as `BigInt` internally and convert only at the boundary — serializing to JSON, or rendering. `JSON.stringify` throws on `BigInt`, which is the single most common surprise when moving snippet code into an API handler.

## Step 6 — reuse the provider

Every snippet constructs its own provider because every snippet is standalone. In an application, construct one and share it:

```js
// lib/arbitrum.js
import { ethers } from "ethers";
export const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL);
```

Contract instances are cheap; providers are not. A new provider per request means a new connection pool per request.

---

## Networks

| Network | Chain id | HTTP | WebSocket |
|---|---|---|---|
| Arbitrum One | 42161 | `https://arb1.arbitrum.io/rpc` | `wss://arb1.arbitrum.io/ws` |
| Arbitrum Sepolia | 421614 | `https://sepolia-rollup.arbitrum.io/rpc` | — (use a provider endpoint) |

Snippets default to Arbitrum One. To develop against the testnet, change `RPC_URL` and the contract addresses — testnet deployments are at different addresses, and the defaults baked into the snippets (ARB, USDC, DAI, CacheManager, ExpressLaneAuction) are mainnet.

The public endpoints above rate limit and are intended for development. Use your own provider for anything that runs continuously.

## Handling secrets

Snippets take keys from the environment, and never from a file or an argument. Carry that forward:

- Keep private keys in your secret manager or environment, never in source.
- Use a dedicated key with only the funds a given job needs.
- `Wallet.createRandom()` as a default — used by several snippets — is a deliberate pattern: the code runs and produces output without a real key, and cannot accidentally touch real funds.

## Patterns worth stealing

**Simulate before you send.** Snippet 021 estimates gas and does a static call before broadcasting. That catches a revert without paying for it.

**Bound every subscription.** Snippets 009 and 028 exit after `MAX_EVENTS` or `MAX_DURATION_MS`. Any long-lived listener needs a comparable stop condition, or it becomes a leak.

**Fail over between endpoints.** Snippet 024 tries a list of endpoints with retries and reports latency for each. Worth copying wholesale if your uptime depends on an RPC provider.

**Read the precompiles.** Snippets 012, 014, and 015 use `ArbGasInfo` and `NodeInterface` for information that has no equivalent on L1 — real L1 versus L2 cost breakdowns, and L2-to-L1 block mapping. Arbitrum-specific applications generally need at least one of these.

## Common pitfalls

| Symptom | Cause |
|---|---|
| `TypeError: Do not know how to serialize a BigInt` | Passing an ethers/web3 return value straight to `JSON.stringify`. Convert with `.toString()` at the boundary. |
| `could not detect network` | RPC URL wrong or unreachable; check for a proxy, or an endpoint that requires an API key. |
| Values off by 10^18 | Missing `formatEther`/`parseEther` (ethers) or `fromWei`/`toWei` (web3). |
| `call revert exception` on a read | Right function, wrong address — or the contract is not deployed on the network you connected to. |
| Listener never fires | HTTP provider used where a WebSocket is needed. `eth_subscribe` requires `wss://`. |
| Different results between runs | Expected. Defaults point at live mainnet contracts. |

## Attribution

Snippets are MIT licensed — see [LICENSE](../LICENSE). You can use them in commercial and closed-source work without attribution. A link back is appreciated, not required.
