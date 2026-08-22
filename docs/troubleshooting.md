# Troubleshooting

Grouped by where you hit the problem.

---

## Using the platform

### The snippet list shows an error instead of cards

The frontend cannot reach the backend. In order of likelihood:

1. **The backend is not running.** `curl http://localhost:3001/api/health` should return `{"status":"ok",…}`.
2. **CORS.** The browser console shows a blocked cross-origin request. `CORS_ORIGIN` in `codex-backend/.env` must contain the frontend's exact origin — scheme included, no trailing slash — and the backend must be restarted after changing it.
3. **Wrong API URL.** The frontend defaults to `http://localhost:3001`. Point it elsewhere with `NEXT_PUBLIC_API_URL`, remembering that the value is baked in at build time; a production build needs rebuilding, not just a new environment variable.

Use the **Retry** action in the error state once the backend is up — it refetches without a page reload.

### "Rate limit reached. Wait a minute and try again."

You exceeded `RUN_RATE_LIMIT_PER_MIN` (default 20) run requests from your IP inside a minute. It resets on a rolling minute; the `RateLimit-Reset` response header gives the exact time. Nothing is broken.

### A run comes back with status `error`

The request succeeded; the snippet failed. Read the logs above the error — they are everything the snippet printed before it stopped. Common causes:

| Error text | What it means |
|---|---|
| `invalid private key` / `invalid BytesLike value` | A snippet with a `YOUR_PRIVATE_KEY_HERE` placeholder was run unmodified. Snippets 002 and 008 are copy-and-edit templates by design — see the [catalog](snippet-catalog.md). |
| `insufficient funds for gas` | The snippet reached the point of broadcasting with an unfunded account. Expected for signing snippets run with a generated key. |
| `call revert exception` / `execution reverted` | The contract rejected the call — usually a wrong address for the network, or arguments the contract does not accept. |
| `could not detect network` / `SERVER_ERROR` | The RPC endpoint is unreachable or rate limiting. Public endpoints throttle; retry, or run the snippet locally against your own provider. |
| `missing revert data` | Calling a function that does not exist at that address. Check that the ABI matches the deployed contract. |

### A run comes back with status `timeout`

The snippet exceeded the wall clock ceiling (90 seconds by default) and was terminated. Logs captured before the kill are still returned. Usually one of:

- an RPC endpoint that has become slow or is throttling,
- a snippet waiting on an event stream with no bound — report it, watchers are supposed to be bounded,
- a historical query scanning a range that has grown too large.

Retrying often works, since the cause is usually upstream latency.

### A run comes back with status `memory`

The run exceeded its heap cap (128 MB by default). Nearly always a query returning more data than expected — a log range that has grown, or an unbounded history scan. Running the snippet locally with a narrower range is the fastest diagnosis.

### The Run button is missing

The selected variant is Solidity. Solidity snippets are contract source for you to compile and deploy — there is nothing to execute server-side. Switch variants, or copy the code out.

### Output looks different from last time

Expected. Snippets read live mainnet state. Block numbers, prices, gas figures, and auction results all move.

---

## Running snippets locally

### `Cannot find module 'ethers'`

Dependencies are not installed in the directory you are running from:

```bash
cd codex-scripts && npm install
```

### `SyntaxError: Cannot use import statement outside a module` / `require is not defined`

Snippets are CommonJS. You are either running one from a directory whose `package.json` sets `"type": "module"`, or you converted it to ESM halfway. Run it from `codex-scripts/`, or convert it completely — see the [Integration Guide](integration-guide.md#step-2--convert-to-your-module-system).

### An environment variable I set is ignored

Check the exact name against the [catalog](snippet-catalog.md), and note that `DRY_RUN` is inverted: only the literal string `"false"` disables the dry run. Anything else, including unset, means simulate.

```bash
DRY_RUN=false node 021_WriteSmartContract_ethers.js   # broadcasts
DRY_RUN=0     node 021_WriteSmartContract_ethers.js   # still a dry run
```

### `TypeError: Do not know how to serialize a BigInt`

You passed an ethers or web3 return value straight into `JSON.stringify`. Convert with `.toString()` at the boundary. The sandbox handles this for you; your own code has to.

---

## Running the backend

### Boot fails with "Invalid environment configuration"

A value in `.env` failed schema validation, and the field errors are printed. Usual causes: a non-numeric `PORT`, an RPC URL missing its scheme, a `LOG_LEVEL` outside the allowed set. The process exits deliberately rather than starting misconfigured.

### Boot fails with "failed to read codex-scripts directory"

The registry could not find the snippets. It looks, in order, at `SCRIPTS_DIR`, then `../../../codex-scripts` relative to the compiled module, then `codex-backend/snippets-data/`. Either run from a full checkout, run `npm run sync-snippets` to populate `snippets-data/`, or set `SCRIPTS_DIR` explicitly.

### A new snippet does not appear

Two possibilities:

1. **The backend has not restarted.** The registry loads once at boot. Restart it.
2. **The filename does not match.** It must be `NNN_PascalCaseName_ethers.js`, `NNN_PascalCaseName_web3.js`, or `NNN_PascalCaseName.sol`, with letters and digits only in the name. Anything else is silently skipped. See [Authoring Snippets](authoring-snippets.md#naming).

### A snippet shows as "Other" with no description

It has no `SNIPPET_META` entry in `codex-backend/src/snippets/categories.ts`, or the key there does not exactly match the snippet id.

### One variant is missing from a snippet

The two files disagree on number or name — `012_ArbGasInfo_ethers.js` alongside `012_ArbGasinfo_web3.js` produces two separate snippets, not one with two variants. The pairing is byte-exact and case-sensitive.

### `POST /api/run` returns `variant_not_available`

The snippet exists but not in the requested variant; the response lists what is available. Solidity-only snippets answer the same way — `{"requested":"ethers","available":["solidity"]}` — because they have no executable variant at all.

### Every request appears to come from the same IP

The backend is behind a proxy or load balancer and Express is not configured to trust it, so the run rate limiter sees one client. Configure the trust proxy setting for your topology.

### A snippet works from my shell but fails in the sandbox

The sandbox deletes the entire process environment and replaces it with only what the run explicitly passes. Anything your shell exported — an RPC key, `NODE_OPTIONS`, a proxy setting — is absent inside the run. Pass what the snippet needs in the request's `env` object; see the [API Reference](api-reference.md#post-apirun).

---

## Still stuck

Open an issue with the snippet id and variant, the full run output or API response body, and whether you hit it on the hosted platform, a local backend, or a direct `node` run. The [bug report template](../.github/ISSUE_TEMPLATE/bug_report.md) asks for exactly what a maintainer needs.
