# API Reference

Base URL in local development: `http://localhost:3001`. All endpoints are under `/api`, accept and return JSON, and require no authentication.

CORS is restricted to the origins in the backend's `CORS_ORIGIN` setting. Request bodies are capped at 256 KB.

| Method | Path | Purpose |
|---|---|---|
| `GET` | [`/api/health`](#get-apihealth) | Liveness probe |
| `GET` | [`/api/snippets`](#get-apisnippets) | List snippets, optionally filtered |
| `GET` | [`/api/snippets/:id`](#get-apisnippetsid) | One snippet with full source |
| `GET` | [`/api/categories`](#get-apicategories) | Categories with snippet counts |
| `POST` | [`/api/run`](#post-apirun) | Execute a snippet in the sandbox |

---

## `GET /api/health`

```bash
curl http://localhost:3001/api/health
```

```json
{ "status": "ok", "uptime": 128.42 }
```

`uptime` is process uptime in seconds. Use this as the target for uptime monitoring and container health checks — it does not touch the registry or any RPC endpoint.

---

## `GET /api/snippets`

Lists every snippet in the registry, sorted by id.

**Query parameters** (both optional)

| Parameter | Type | Behaviour |
|---|---|---|
| `category` | string | Exact match against the snippet's category |
| `search` | string | Case-insensitive substring match against id, title, and description |

Applied together they narrow cumulatively. An unknown category is not an error — it returns zero items.

```bash
curl "http://localhost:3001/api/snippets?category=Timeboost"
curl "http://localhost:3001/api/snippets?search=gas"
```

**Response `200`**

```json
{
  "count": 29,
  "items": [
    {
      "id": "001_ARBPriceOracle",
      "name": "ARBPriceOracle",
      "title": "ARB Price Oracle",
      "description": "Fetch the latest ARB/USD price from Chainlink oracles on Arbitrum One and Sepolia testnet",
      "category": "Stylus & DeFi",
      "language": "solidity",
      "variants": { "solidity": "// SPDX-License-Identifier: MIT\n..." }
    }
  ]
}
```

`variants` carries the **full source** of every variant, keyed by `ethers`, `web3`, or `solidity`. The list response is therefore the entire library — a few hundred kilobytes — which is why the frontend fetches it once and filters client-side. If you only need metadata, ignore the `variants` field; there is no metadata-only mode.

**Errors**

| Status | Body | Cause |
|---|---|---|
| `400` | `{"error":"invalid_query","details":{…}}` | A query parameter failed validation |

---

## `GET /api/snippets/:id`

One snippet by id, e.g. `011_TimeboostAuctionHistory`.

```bash
curl http://localhost:3001/api/snippets/025_GetBlockNumber
```

**Response `200`** — the same object shape as an item in the list, including full source for each variant.

```json
{
  "id": "025_GetBlockNumber",
  "name": "GetBlockNumber",
  "title": "Get Block Number",
  "description": "Fetch the current block number from the Arbitrum network",
  "category": "RPC & Blocks",
  "language": "javascript",
  "variants": {
    "ethers": "const { ethers } = require(\"ethers\");\n…",
    "web3": "const { Web3 } = require(\"web3\");\n…"
  }
}
```

**Errors**

| Status | Body | Cause |
|---|---|---|
| `404` | `{"error":"snippet_not_found","id":"…"}` | No snippet with that id |

---

## `GET /api/categories`

The fixed category list with live counts computed from the registry. Categories with no snippets are included with `count: 0`.

```bash
curl http://localhost:3001/api/categories
```

```json
{
  "categories": [
    { "name": "Stylus & DeFi", "count": 3 },
    { "name": "Timeboost", "count": 8 },
    { "name": "Arbitrum Infrastructure", "count": 4 },
    { "name": "Wallet & Signing", "count": 4 },
    { "name": "Smart Contracts", "count": 6 },
    { "name": "RPC & Blocks", "count": 4 }
  ]
}
```

Snippets with no metadata entry fall into a category named `Other`, which is not part of this list but does appear on the snippet itself.

---

## `POST /api/run`

Executes a snippet in the sandbox and returns its captured output. The endpoint takes a snippet **id** — it never accepts source code. See [Architecture → Execution sandbox](architecture.md#execution-sandbox--srcsandboxexecutorts) for what runs and under what limits.

**Rate limited** to `RUN_RATE_LIMIT_PER_MIN` requests per IP per minute (default 20), with standard `RateLimit-Limit`, `RateLimit-Remaining`, and `RateLimit-Reset` response headers.

**Request body**

| Field | Type | Required | Constraints |
|---|---|---|---|
| `snippetId` | string | yes | Must match `^\d{3}_[A-Za-z0-9]+$` |
| `variant` | `"ethers"` \| `"web3"` | yes | Solidity is rejected |
| `env` | object of string → string | no | Environment for this run; replaces the process environment entirely |
| `timeoutMs` | integer | no | 500–90 000, defaults to `SANDBOX_TIMEOUT_MS` |
| `memoryMb` | integer | no | 32–512, defaults to `SANDBOX_MEMORY_MB` |

```bash
curl -X POST http://localhost:3001/api/run \
  -H 'Content-Type: application/json' \
  -d '{
    "snippetId": "022_ReadSmartContract",
    "variant": "ethers",
    "env": { "CONTRACT_ADDRESS": "0x912CE59144191C1204E64559FE8253a0e49E6548" },
    "timeoutMs": 30000
  }'
```

`env` is how you drive a snippet that takes input — it is the same set of variables you would export before running the file with `node`. The [Snippet Catalog](snippet-catalog.md) lists what each snippet reads. Nothing from the host environment is inherited, so a variable you do not pass is genuinely absent inside the run.

> The web interface does not currently send `env`; it runs snippets with their published defaults. Supplying `env` is an API-level capability.

**Response `200`**

```json
{
  "snippetId": "025_GetBlockNumber",
  "variant": "ethers",
  "status": "ok",
  "logs": [
    { "level": "log", "message": "Block: 391284771", "ts": 412 }
  ],
  "result": null,
  "exitCode": 0,
  "durationMs": 431
}
```

| Field | Meaning |
|---|---|
| `status` | `ok`, `error`, `timeout`, or `memory` |
| `logs` | Captured console output in order; `level` is `log`/`info`/`warn`/`error`/`debug`, `ts` is milliseconds since the run started |
| `result` | Stringified value the snippet's top-level async body returned, or `null` |
| `error` | Present when `status` is not `ok` — the error message or stack |
| `exitCode` | The snippet's exit code, whether from `process.exit()` or worker termination |
| `durationMs` | Wall-clock duration of the run |

A snippet that fails still returns HTTP `200`. **A non-`ok` `status` is the failure signal, not the HTTP code** — the request itself succeeded; the code inside it did not. Logs captured before the failure are always included.

```json
{
  "snippetId": "021_WriteSmartContract",
  "variant": "web3",
  "status": "error",
  "logs": [{ "level": "log", "message": "Wallet: 0x…", "ts": 118 }],
  "error": "Error: insufficient funds for gas * price + value\n    at …",
  "exitCode": 1,
  "durationMs": 1204
}
```

**Errors**

| Status | Body | Cause |
|---|---|---|
| `400` | `{"error":"invalid_body","details":{…}}` | Body failed validation — bad id format, unknown variant, out-of-range limits |
| `400` | `{"error":"variant_not_available","requested":"web3","available":["ethers"]}` | The snippet has no such variant. This is also what a Solidity-only snippet returns: `{"requested":"ethers","available":["solidity"]}` |
| `400` | `{"error":"solidity_execution_not_supported","id":"…"}` | Defensive guard for Solidity snippets. Not reachable through the public contract — a Solidity-only snippet has no `ethers` or `web3` variant, so it returns `variant_not_available` first. |
| `404` | `{"error":"snippet_not_found","id":"…"}` | No snippet with that id |
| `429` | `{"error":"rate_limited"}` | Per-IP run limit exceeded |
| `500` | `{"error":"run_failed"}` | The executor itself failed, not the snippet |

---

## Errors in general

Any unmatched route returns `404 {"error":"not_found"}`. An unhandled exception returns `500 {"error":"internal_error"}`; details are logged server-side and deliberately not returned.

Error bodies always carry a stable machine-readable `error` string. Branch on that, not on the HTTP status alone, since `400` covers several distinct cases.

## Example: run every snippet and report failures

Useful as a smoke test against a deployment.

```bash
API=http://localhost:3001

curl -s $API/api/snippets | jq -r '.items[] | select(.language=="javascript") | .id' |
while read -r id; do
  for variant in ethers web3; do
    status=$(curl -s -X POST $API/api/run \
      -H 'Content-Type: application/json' \
      -d "{\"snippetId\":\"$id\",\"variant\":\"$variant\"}" | jq -r '.status // .error')
    printf '%-32s %-7s %s\n' "$id" "$variant" "$status"
    sleep 3   # stay under the rate limit
  done
done
```

Snippets that require credentials or a specific contract address report `error` here by design — see the [Snippet Catalog](snippet-catalog.md) for which ones and why.
