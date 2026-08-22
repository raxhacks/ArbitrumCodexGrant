# Architecture

Arbitrum Codex is three independent parts: a library of plain Node.js scripts, an API that indexes and executes them, and a web interface that consumes that API.

```
                  ┌─────────────────────────────────────────┐
                  │  codex-frontend  (Next.js 16 / React 19)│
                  │  discovery · search · highlight · copy  │
                  └───────────────┬─────────────────────────┘
                                  │ fetch (NEXT_PUBLIC_API_URL)
                                  │ GET /api/snippets · /api/categories
                                  │ POST /api/run
                  ┌───────────────▼─────────────────────────┐
                  │  codex-backend  (Express + TypeScript)  │
                  │                                         │
                  │   routes/snippets.ts   routes/run.ts    │
                  │          │                  │           │
                  │   snippets/registry.ts   sandbox/       │
                  │          │               executor.ts    │
                  │          │                  │           │
                  │          │            worker_thread     │
                  │          │            (isolated run)    │
                  └──────────┼──────────────────┼───────────┘
                             │ read at boot     │ JSON-RPC
                  ┌──────────▼──────────┐   ┌───▼─────────────┐
                  │   codex-scripts/    │   │ Arbitrum One /  │
                  │   NNN_Name_*.js     │   │ Sepolia RPC     │
                  └─────────────────────┘   └─────────────────┘
```

## The library — `codex-scripts/`

Plain CommonJS Node.js files with no project scaffolding. Each is runnable directly with `node`, which is deliberate: the thing a developer copies is the thing that was tested, with no build step or framework shim in between.

Filenames are the data model. `NNN_PascalCaseName_ethers.js`, `NNN_PascalCaseName_web3.js`, and `NNN_PascalCaseName.sol` are parsed by the registry into a single snippet with up to three variants. Nothing else pairs them — the number and name must match exactly.

## The backend — `codex-backend/`

Express 4 on Node 20+, written in TypeScript as ES modules, started with `tsx` in development and compiled with `tsc` for production.

### Boot sequence

1. `config.ts` parses `process.env` through a Zod schema. Every setting has a default; an invalid value (a non-numeric port, a malformed RPC URL) logs the field errors and exits with code 1 rather than starting in a bad state.
2. `server.ts` installs Helmet, CORS from the `CORS_ORIGIN` allowlist, a 256 KB JSON body limit, and `pino-http` request logging.
3. `loadRegistry()` runs **before** the server starts listening. If the snippet directory cannot be read, boot fails loudly — the service never comes up serving an empty library.
4. Routes mount under `/api`, followed by a 404 handler and a catch-all error handler that logs the real error and returns `{"error":"internal_error"}` without leaking internals.
5. `SIGINT` and `SIGTERM` close the HTTP server before exiting.

### Snippet registry — `src/snippets/registry.ts`

The registry is an in-memory `Map<string, Snippet>` built once at boot.

**Where it reads from**, in priority order:

1. `SCRIPTS_DIR` if set — an explicit absolute or relative path.
2. `../../../codex-scripts` relative to the compiled module — the monorepo layout, used in development.
3. `../../snippets-data` — a copy produced by `scripts/sync-snippets.mjs`, which the `prebuild` step runs automatically. This is what makes the backend deployable on its own, without the rest of the repository.

**How a snippet is assembled.** Filenames are matched against `/^(\d{3})_([A-Za-z0-9]+?)(?:_(ethers|web3))?\.(js|sol)$/`. A `.js` file without an `_ethers` or `_web3` suffix is ignored; so is anything else in the directory. Files sharing a number and name merge into one snippet, each contributing one variant. Title, description, and category come from `SNIPPET_META` in `categories.ts`; a snippet with no metadata entry still loads, with its raw name as title and category `"Other"`.

**Consequence to know about:** the registry is read once. Adding, renaming, or editing a snippet file requires a backend restart to take effect. There is no reload endpoint and no filesystem watcher.

### Execution sandbox — `src/sandbox/executor.ts`

`runSnippet()` executes snippet source in a fresh `worker_threads` Worker created with `eval: true`, and resolves a structured result. One worker per request, terminated when the request settles.

A small runtime prelude is injected into every worker before the snippet body:

- **Environment scrub.** Every key in `process.env` is deleted, then replaced with only the environment explicitly passed for this run (plus `NODE_OPTIONS=""`). The host's real environment — RPC credentials, deployment secrets, anything on the machine — is not visible to snippet code.
- **Console capture.** `log`, `info`, `warn`, `error`, and `debug` are replaced with functions that post structured messages to the parent. Values are stringified safely, with `BigInt` rendered as `123n` rather than throwing inside `JSON.stringify`, and `Error` objects rendered as their stack.
- **Exit interception.** `process.exit(code)` reports the intended exit code to the parent and then exits the worker cleanly, so a snippet's `process.exit(1)` on a caught error becomes a reported failure rather than a killed process with no output.
- **Failure capture.** `uncaughtException` and `unhandledRejection` are forwarded as errors instead of tearing down the worker silently.
- **Async wrapper.** The snippet is wrapped in an async IIFE and evaluated, so top-level `await` works and a returned value is captured as `result`.

Limits enforced by the parent:

| Limit | Default | Bounds | Effect when exceeded |
|---|---|---|---|
| Wall clock | `SANDBOX_TIMEOUT_MS` (90 000 ms) | 500–90 000 ms per request | Worker terminated, `status: "timeout"` |
| Heap | `SANDBOX_MEMORY_MB` (128 MB) | 32–512 MB per request | `status: "memory"` |
| Young generation | `min(32, memoryMb / 4)` MB | derived | contributes to the heap cap |

Timeout and out-of-memory both return whatever logs the snippet produced before it died, which is usually enough to see where it got stuck. OOM is detected by matching the worker error against `JavaScript heap out of memory` / `Allocation failed`, since V8 surfaces a resource-limit kill as a generic worker error.

Status resolution: `ok` requires exit code 0, no captured error, and no non-zero explicit exit code. Anything else is `error`, except the two resource cases above.

### What the sandbox is and is not

The security boundary is **which code is allowed to run**, not what that code can do once running.

`POST /api/run` accepts a snippet **id**, looks the source up in the registry, and executes that. It never accepts source code from a client. Every executable line in the sandbox is first-party code that was reviewed and merged into `codex-scripts/`.

Within the worker, snippet code has ordinary Node.js capability — it could `require("node:fs")` or open a socket. A worker thread is an isolation and resource-limit mechanism, not a jail. This is acceptable precisely because arbitrary code cannot reach it; it also means **the snippet review process in [CONTRIBUTING.md](../CONTRIBUTING.md) is a security control**, not a style preference. If you fork this and add a "run arbitrary code" feature, the worker sandbox alone is not sufficient — you need process- or VM-level isolation.

### Routes

`routes/snippets.ts` serves discovery: list with optional `category` and `search` filters, single snippet by id, and categories with live counts derived from the registry rather than hard-coded.

`routes/run.ts` handles execution: a per-IP rate limiter (`RUN_RATE_LIMIT_PER_MIN`, default 20/min) with standard `RateLimit-*` headers, Zod validation of the body, then registry lookup, variant availability check, and an explicit rejection of Solidity snippets before anything is executed.

Full request and response shapes are in the [API Reference](api-reference.md).

## The frontend — `codex-frontend/`

Next.js 16 with the App Router, React 19, Tailwind CSS 4, and Prism for highlighting. The interface is a single client-rendered page with two views, About and Snippets.

**Data loading.** `lib/useSnippets.ts` fetches `/api/snippets` and `/api/categories` in parallel on mount, through an `AbortController` that is aborted on unmount so a fast navigation cannot set state on a dead component. It exposes `isLoading`, `error`, and a `reload()` that the error state offers as a retry. Filtering and search run client-side over the loaded list — the backend supports server-side filters too, but the whole library is small enough that the round trip is not worth it.

**API client.** `lib/api.ts` is the only place that knows the backend exists. It reads `NEXT_PUBLIC_API_URL` (defaulting to `http://localhost:3001`), holds the shared TypeScript types, and translates error bodies into human sentences — `rate_limited` becomes "Rate limit reached. Wait a minute and try again.", `variant_not_available` names the variants that do exist.

**Snippet card.** `components/SnippetCard.tsx` is collapsed by default with a three-line source preview, and expands to the variant toggle, full source, Run button, and results. Selecting a different variant clears the previous run so stale output is never shown against different code. Each run gets its own `AbortController`, aborted if the user runs again or navigates away.

**Run output.** Status badge, duration, captured logs colour-coded by level, and the returned value if the snippet produced one. Errors render in the same place, whether they came from the snippet or from the transport.

**Code block.** `components/CodeBlock.tsx` re-highlights on content or language change and handles clipboard copy with a two-second confirmation.

## Testing

Vitest, in `codex-backend/tests/`:

- `executor.test.ts` — sandbox behaviour: successful runs, captured console output, thrown errors, timeout handling, environment scrubbing.
- `registry.test.ts` — filename parsing, variant pairing, metadata merging.
- `routes.test.ts` — HTTP contract via supertest: status codes, response shapes, validation failures.

```bash
cd codex-backend
npm test          # single run
npm run test:watch
npm run check     # types only
```

## Deliberate design decisions

**Snippets are files, not database rows.** The library is the repository. A contributor's pull request is the publishing mechanism; git history is the audit trail; anyone can clone and run the same code without the platform. No migration, no admin panel, no drift between what is displayed and what is executed.

**The registry loads at boot, not per request.** 29 snippets in memory is trivial, and it makes every response deterministic for the process's lifetime. The cost is a restart to pick up new files — acceptable for a library that changes by pull request.

**One worker per run, always terminated.** No pooling, no reuse. Reused workers would leak state between runs — a mutated global, a lingering interval, an open WebSocket. Startup cost is negligible next to the RPC round trips the snippets are actually waiting on.

**Dry-run by default for anything that spends.** A public Run button attached to code that broadcasts transactions is a foot-gun. Snippets that write to chain simulate and report gas unless `DRY_RUN=false` is explicitly passed.

**Two libraries, one behaviour.** Every snippet exists as both `ethers` and `web3`. Developers do not migrate their stack to use an example, and seeing the same operation expressed in both is itself instructive.
