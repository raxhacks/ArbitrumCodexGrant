# Authoring Snippets

The reference for adding a snippet to the library. Read [CONTRIBUTING.md](../CONTRIBUTING.md) first for the process; this document is the technical contract.

## The contract in one paragraph

A snippet is a standalone CommonJS Node.js file that runs to completion on its own, using only `ethers`, `web3`, and the Node standard library, taking any input from environment variables with working defaults, printing its output with `console.log`, never containing a secret, and never broadcasting a transaction unless explicitly told to. It ships in two variants — one per library — with a metadata entry that gives it a title, a description, and a category.

## Naming

```
NNN_PascalCaseName_ethers.js     ethers.js v6 variant
NNN_PascalCaseName_web3.js       web3.js v4 variant
NNN_PascalCaseName.sol           Solidity contract (display only)
```

- `NNN` — the next free three-digit number, zero-padded. Numbers are permanent identifiers; never renumber an existing snippet.
- `PascalCaseName` — letters and digits only. No underscores, hyphens, or spaces; the registry's filename pattern rejects them.
- The name must be **byte-identical** across variants. That string is the only thing pairing them into one snippet.

The registry matches `/^(\d{3})_([A-Za-z0-9]+?)(?:_(ethers|web3))?\.(js|sol)$/`. Files that do not match — a `.js` with no variant suffix, a README, a helper module — are silently ignored. If your snippet does not appear after a restart, the filename is the first thing to check.

## File structure

Follow the existing layout; it is what makes the library scannable:

```js
const { ethers } = require("ethers");

// 1. Configuration — everything a reader might want to change, at the top
const RPC_URL = "https://arb1.arbitrum.io/rpc";
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "0x912CE59144191C1204E64559FE8253a0e49E6548";
const DRY_RUN = process.env.DRY_RUN !== "false";

// 2. ABI — only the functions used, as human-readable signatures
const CONTRACT_ABI = [
    "function balanceOf(address account) external view returns (uint256)",
];

// 3. Logic — one async function, named for what it does
async function readBalance() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

    const balance = await contract.balanceOf(CONTRACT_ADDRESS);
    console.log("Balance:", ethers.formatEther(balance), "ARB");
}

// 4. Entry point — invoke, catch, exit non-zero on failure
readBalance().catch((err) => {
    console.error("Error:", err.message);
    process.exit(1);
});
```

Four-space indentation, double-quoted strings, semicolons. Comments explain *why* a step is needed, not what the line does.

## Rules

### Both variants, one behaviour

Every JavaScript snippet needs an `_ethers.js` and a `_web3.js` version. They should perform the same operations in the same order and print comparable output — a developer comparing them is learning the difference between the libraries, so gratuitous divergence is noise. Idiomatic differences (`ethers.formatEther` vs `web3.utils.fromWei`, `Contract` vs `eth.Contract`) are expected; different logic is not.

### No secrets, ever

No private key, mnemonic, API key, or funded address in a committed file. Two acceptable patterns:

```js
// Preferred — runs unmodified, produces real output, touches nothing
const PRIVATE_KEY = process.env.PRIVATE_KEY || ethers.Wallet.createRandom().privateKey;

// For snippets that broadcast value-bearing transactions
const PRIVATE_KEY = "YOUR_PRIVATE_KEY_HERE";
```

Use the second only when the snippet's whole purpose is to spend, so that an unedited run fails immediately rather than doing something with a random empty account. Snippets 002 and 008 are the only two in the library that qualify.

### It has to stop

The sandbox terminates a run at 90 seconds. Aim for well under ten. Anything that watches the chain takes both bounds and exits on whichever hits first:

```js
const MAX_EVENTS = Number(process.env.MAX_EVENTS ?? 10);
const MAX_DURATION_MS = Number(process.env.MAX_DURATION_MS ?? 8000);
```

Close WebSocket providers and clear intervals before returning. Do not rely on the worker teardown to clean up after you.

### Safe by default

If the snippet can move funds or change chain state, it defaults to a dry run:

```js
const DRY_RUN = process.env.DRY_RUN !== "false";
// … estimate gas, static-call, print what would happen …
if (DRY_RUN) return;
// … only now broadcast …
```

Note the polarity: anything other than the exact string `"false"` — including unset — means dry run.

### Input via environment, with defaults

Every input reads from `process.env` and falls back to a value that makes the snippet demonstrable: a known transaction hash, a well-known token address, a freshly generated wallet. A snippet that requires configuration to produce any output cannot be run from the platform, and loses most of its value.

Document each variable in [the catalog](snippet-catalog.md) when you add it.

### Dependencies

`ethers`, `web3`, and the Node standard library. Nothing else. The sandbox resolves modules from the backend's own `node_modules`, so an unlisted dependency fails at runtime with a module-not-found error, and a reader copying the snippet gets an install they did not expect.

### Output

`console.log` is the interface. It is captured by the sandbox, streamed to the browser, and colour-coded by level. Print the values a developer would want to verify. Use section headers in caps for long outputs, matching the existing snippets. Errors go to `console.error` and exit non-zero.

Avoid printing hundreds of lines — the run panel is scrollable but not infinite, and log capture costs memory against the run's heap limit.

## Registering metadata

Add an entry to `SNIPPET_META` in `codex-backend/src/snippets/categories.ts`:

```ts
"030_YourSnippetName": {
  title: "Your Snippet Name",
  description: "One sentence, present tense, describing what it does and against what",
  category: "Smart Contracts",
},
```

- `title` — how it appears on the card. Title case, no trailing punctuation.
- `description` — one sentence, no line breaks. This is what the search box matches against, so include the terms someone would look for.
- `category` — must be one of the six in `CATEGORIES`. Adding a category means adding it there and giving it an icon and a blurb in `codex-frontend/app/page.tsx`; propose that in an issue first.

Without a metadata entry the snippet still loads, but appears with its raw filename as the title, no description, and category `Other`.

## Testing your snippet

```bash
# 1. Runs standalone
cd codex-scripts
node 030_YourSnippetName_ethers.js
node 030_YourSnippetName_web3.js

# 2. Runs standalone with your inputs
CONTRACT_ADDRESS=0x… node 030_YourSnippetName_ethers.js

# 3. Registry picks it up — restart first, the registry loads at boot
cd ../codex-backend && npm run dev
curl -s localhost:3001/api/snippets/030_YourSnippetName | jq '{title, category, variants: (.variants | keys)}'

# 4. Runs in the sandbox — the environment differs from your shell
curl -s -X POST localhost:3001/api/run \
  -H 'Content-Type: application/json' \
  -d '{"snippetId":"030_YourSnippetName","variant":"ethers"}' | jq '{status, durationMs, logs: [.logs[].message]}'

# 5. Backend still healthy
npm run check && npm test
```

Step 4 is the one people skip and the one that catches real problems. The sandbox scrubs the environment completely, so a snippet that quietly depended on something exported in your shell — or on `NODE_OPTIONS`, or on a cached credential — passes step 1 and fails there.

Check both variants at step 4, and check the timing: if `durationMs` is more than a few thousand, reconsider what the snippet is waiting on.

## Checklist

- [ ] Filenames match `NNN_PascalCaseName_{ethers,web3}.js`, next free number, identical names
- [ ] Both variants present, same behaviour, comparable output
- [ ] No keys, mnemonics, API keys, or funded addresses
- [ ] Every input read from `process.env` with a working default
- [ ] Terminates on its own; watchers bounded; sockets closed
- [ ] Dry run by default if it can spend or change state
- [ ] Only `ethers`, `web3`, Node standard library
- [ ] `SNIPPET_META` entry with title, description, existing category
- [ ] Verified through `POST /api/run` for both variants
- [ ] Added to [the catalog](snippet-catalog.md) with its inputs and status
