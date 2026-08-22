# Deployment

Running your own instance of Arbitrum Codex: the backend API and the frontend interface. They deploy independently.

## Requirements

- Node.js 20 or newer, on a host that runs a **long-lived process**.
- Outbound HTTPS to your Arbitrum RPC endpoints.

> The backend is not a good fit for a short-lived serverless function. Runs use `worker_threads` and can hold a request open for up to 90 seconds, so a platform with a 10-second function ceiling will cut runs off mid-execution. Deploy it as a container or a long-running Node process. The frontend is a normal Next.js app and deploys anywhere Next.js does.

## Backend

### Build

```bash
cd codex-backend
npm ci
npm run build      # prebuild copies codex-scripts/ into snippets-data/, then tsc emits dist/
npm start          # node dist/server.js
```

`npm run build` runs `scripts/sync-snippets.mjs` first, which copies every `.js` and `.sol` file from `../codex-scripts` into `codex-backend/snippets-data/`. That directory is the registry's third-choice source and is what lets the backend run **without the rest of the repository present** — useful for a container that only ships `codex-backend/`. If `codex-scripts/` is missing and `snippets-data/` already has content, the sync step exits successfully and leaves it alone.

Ship `dist/`, `node_modules/` (or `package*.json` and install on the host), and `snippets-data/`.

### Configuration

Everything is optional and validated at boot with Zod; an invalid value stops the process rather than starting it misconfigured.

| Variable | Default | Notes |
|---|---|---|
| `PORT` | `3001` | |
| `LOG_LEVEL` | `info` | `fatal`, `error`, `warn`, `info`, `debug`, `trace` |
| `CORS_ORIGIN` | `http://localhost:3000` | Comma-separated allowlist. **Set this in production** — it must list your frontend's exact origin, scheme included. |
| `ARBITRUM_ONE_RPC_URL` | `https://arb1.arbitrum.io/rpc` | Must be a valid URL |
| `ARBITRUM_SEPOLIA_RPC_URL` | `https://sepolia-rollup.arbitrum.io/rpc` | Must be a valid URL |
| `SANDBOX_TIMEOUT_MS` | `90000` | Per-run wall clock ceiling |
| `SANDBOX_MEMORY_MB` | `128` | Per-run heap ceiling |
| `RUN_RATE_LIMIT_PER_MIN` | `20` | Run requests per IP per minute |
| `SCRIPTS_DIR` | unset | Explicit path to the snippet directory, overriding discovery |
| `NODE_ENV` | unset | Set to `production` to emit JSON logs instead of pretty-printed ones |

Note that the RPC URLs configure the **service**, not the snippets — snippets carry their own endpoints in their source, which is what makes them copy-and-run.

### Container

```dockerfile
FROM node:20-slim
WORKDIR /app

COPY codex-backend/package*.json ./codex-backend/
RUN cd codex-backend && npm ci

COPY codex-scripts/ ./codex-scripts/
COPY codex-backend/ ./codex-backend/

WORKDIR /app/codex-backend
RUN npm run build && npm prune --omit=dev

ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "dist/server.js"]
```

Copy `codex-scripts/` before building so the prebuild sync has a source. After the build, `snippets-data/` is baked into the image and the registry no longer depends on the sibling directory.

### Process management

The server handles `SIGINT` and `SIGTERM` by closing the HTTP server before exiting, so a rolling restart drains in-flight requests. Give it a termination grace period longer than `SANDBOX_TIMEOUT_MS` if you do not want to cut off runs.

### Health checks

```
GET /api/health  →  {"status":"ok","uptime":128.42}
```

Cheap and dependency-free — no registry access, no RPC calls. Use it for container liveness, load balancer checks, and external uptime monitoring.

### Sizing

Each concurrent run is one worker thread with a heap cap of `SANDBOX_MEMORY_MB`. With the defaults, budget roughly `128 MB × expected concurrent runs` on top of the base process, and remember that the rate limit is per IP, not global — it does not cap total concurrency. On a small instance, lower `SANDBOX_MEMORY_MB` or put a global concurrency limit in front of `/api/run`.

Snippets are I/O-bound on RPC calls rather than CPU-bound, so a modest instance handles far more concurrent runs than its core count suggests.

## Frontend

```bash
cd codex-frontend
npm ci
NEXT_PUBLIC_API_URL=https://api.your-domain.example npm run build
npm start
```

| Variable | Default | Notes |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | Backend base URL, no trailing slash |

`NEXT_PUBLIC_API_URL` is inlined at **build time**, not read at runtime. Changing it means rebuilding. The value is visible in the browser bundle — which is fine, since the API is public and unauthenticated.

The frontend fetches from the browser, so the backend must be reachable from your users' networks and its `CORS_ORIGIN` must include the frontend's origin.

## Wiring the two together

The single most common deployment failure is a CORS mismatch: the site loads, but the snippet list shows an error. Check that

- `CORS_ORIGIN` on the backend contains the frontend's exact origin — `https://codex.example.com`, not `codex.example.com`, and not a trailing slash;
- `NEXT_PUBLIC_API_URL` was set at build time, not just in the runtime environment;
- both are on HTTPS. A browser on an HTTPS page will block requests to an HTTP API.

Verify from a machine that is not the server:

```bash
curl -s https://api.your-domain.example/api/health
curl -s -I -X OPTIONS https://api.your-domain.example/api/snippets \
  -H "Origin: https://codex.example.com" \
  -H "Access-Control-Request-Method: GET" | grep -i access-control
```

## Post-deployment smoke test

```bash
API=https://api.your-domain.example

curl -s $API/api/health | jq .status
curl -s $API/api/snippets | jq .count                    # expect 29
curl -s $API/api/categories | jq '.categories | length'  # expect 6
curl -s -X POST $API/api/run -H 'Content-Type: application/json' \
  -d '{"snippetId":"025_GetBlockNumber","variant":"ethers"}' | jq '{status, durationMs}'
```

The full sweep across every snippet is in the [API Reference](api-reference.md#example-run-every-snippet-and-report-failures).

## Operating notes

**Updating the library.** The registry is read once at boot. Deploying new or changed snippets requires a restart — there is no reload endpoint.

**Logs.** `pino` structured JSON when `NODE_ENV=production`, pretty-printed otherwise. Every request is logged by `pino-http`; each run logs its snippet id, variant, and limits before executing, and any executor failure logs the error. Snippet `console.log` output is returned to the caller, not written to the server log.

**What to alert on.** `/api/health` failing; a rise in `status: "timeout"` runs, which usually means a degraded RPC endpoint rather than a code problem; sustained `429`s from a single source.

**Hardening.** Helmet sets the default security headers, the JSON body limit is 256 KB, and only `/api/run` is rate limited. Put a reverse proxy in front for TLS, a global connection limit, and rate limiting on the read endpoints if you need it. The trust proxy setting matters: behind a load balancer, configure Express to trust it, or the run limiter will see every request as coming from one IP.
