# Contributing to Arbitrum Codex

Arbitrum Codex is a public library of production-ready Arbitrum code templates, each runnable in the browser. Contributions of new snippets, fixes to existing ones, and platform improvements are all welcome.

Everything below is the short version. Deeper references live in [`docs/`](docs/README.md) — in particular [Authoring Snippets](docs/authoring-snippets.md) for the snippet contract and [Architecture](docs/architecture.md) for how the pieces fit together.

## Ways to contribute

| Contribution | Where it lands | Start with |
|---|---|---|
| New code snippet | `codex-scripts/` + `codex-backend/src/snippets/categories.ts` | [Authoring Snippets](docs/authoring-snippets.md) |
| Fix or update an existing snippet | `codex-scripts/` | Open an issue first if behaviour changes |
| Backend / API change | `codex-backend/src/` | [API Reference](docs/api-reference.md) |
| Frontend change | `codex-frontend/` | [Architecture](docs/architecture.md) |
| Documentation | `docs/`, `README.md` | This file |

## Before you open a pull request

1. **Open an issue first** for anything larger than a typo — a new snippet, an API change, or a UI redesign. It avoids duplicated work and settles scope (category, snippet number, naming) before the code exists.
2. **One logical change per pull request.** A new snippet and a backend refactor belong in separate PRs.
3. **Run the checks** listed under [Local checks](#local-checks). A PR that fails `npm test` or `npm run check` will not be merged.

## Snippet contribution rules

Every snippet in `codex-scripts/` is public example code that developers copy directly into production work, and it is executed on the platform's servers. That imposes a hard contract:

- **Both libraries.** Ship an `_ethers.js` and a `_web3.js` variant of the same behaviour, producing comparable console output. Solidity contributions ship a single `.sol` file and are display-only.
- **Naming.** `NNN_PascalCaseName_ethers.js` / `NNN_PascalCaseName_web3.js` / `NNN_PascalCaseName.sol`, where `NNN` is the next free three-digit number. The name must match across variants — the registry pairs them by it.
- **No secrets.** Never commit a private key, mnemonic, API key, or funded address. Read them from `process.env` with a safe fallback, or use an obvious placeholder such as `YOUR_PRIVATE_KEY_HERE`.
- **Terminates on its own.** A snippet must exit without human input. Anything that watches the chain needs `MAX_EVENTS` and `MAX_DURATION_MS` bounds — the sandbox kills it at 90 seconds regardless.
- **Safe by default.** A snippet that spends funds or sends a transaction must default to a dry run (`const DRY_RUN = process.env.DRY_RUN !== "false"`) so that running it on the platform simulates rather than broadcasts.
- **Self-contained.** Only `ethers`, `web3`, and the Node standard library. No local file reads, no extra dependencies, no network calls beyond the RPC endpoints.
- **Readable output.** Log what a developer needs to see with `console.log`; the platform captures and renders it. Fail with a clear message rather than a raw stack trace where you can.
- **Register the metadata.** Add a `SNIPPET_META` entry in `codex-backend/src/snippets/categories.ts` with a title, a one-sentence description, and an existing category. Without it the snippet appears as "Other" with no description.

## Local checks

```bash
# Backend: types + full test suite
cd codex-backend
npm install
npm run check
npm test

# Frontend: lint + production build
cd codex-frontend
npm install
npm run lint
npm run build
```

For a new snippet, also confirm it runs end-to-end through the platform, not just from the terminal:

```bash
cd codex-backend && npm run dev          # terminal 1
curl -s -X POST http://localhost:3001/api/run \
  -H 'Content-Type: application/json' \
  -d '{"snippetId":"0NN_YourSnippet","variant":"ethers"}' | jq .status
```

The registry is read once at boot, so restart the backend after adding files.

## Commit and pull request style

- Commit messages: imperative mood, one line, scoped where useful — `Add L2 gas estimation snippet`, `Fix Timeboost round rounding in web3 variant`.
- PR description: what changed, why, and how you verified it. For snippets, paste the console output of a successful run.
- Fill in the pull request template checklist. It exists so reviewers can check the snippet contract quickly.

## Review process

A maintainer reviews for correctness against live Arbitrum state, parity between the ethers and web3 variants, adherence to the snippet contract, and documentation accuracy. Expect review comments on public example code to be exacting — these snippets are copied into other people's production systems.

## Reporting security issues

Do not open a public issue for a vulnerability. Follow [SECURITY.md](SECURITY.md).

## Code of conduct

Participation is governed by [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
