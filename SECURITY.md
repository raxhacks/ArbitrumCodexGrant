# Security Policy

## Reporting a vulnerability

Do not open a public issue for a security vulnerability.

Report it through GitHub's private vulnerability reporting on this repository (Security → Report a vulnerability), or contact a maintainer directly. Include:

- what the issue is and where (file, endpoint, or snippet id),
- reproduction steps or a proof of concept,
- what an attacker gains.

You can expect an acknowledgement within a few days and an assessment of severity and fix timeline after that. Please give us a reasonable window to ship a fix before disclosing publicly.

## What is in scope

- **Sandbox escape** — any way to make `POST /api/run` execute code outside the intended snippet, read the host's real environment variables, or persist state between runs.
- **Backend vulnerabilities** — injection, denial of service beyond the documented rate limits, CORS or header misconfiguration, information disclosure in error responses.
- **Malicious or unsafe snippets** — a snippet in `codex-scripts/` that leaks keys, broadcasts a transaction when it should dry-run, or points at a hostile contract address.
- **Frontend vulnerabilities** — XSS through rendered snippet content or run output.

## What is not in scope

- The fact that snippets in `codex-scripts/` contain placeholders such as `YOUR_PRIVATE_KEY_HERE`. These are templates; they are meant to be edited.
- Rate limiting being reachable at its documented threshold (20 run requests per minute per IP by default).
- Outages or errors caused by upstream public RPC endpoints.
- Vulnerabilities in `ethers`, `web3`, or other dependencies — report those upstream; tell us if a fix requires a change here.

## Security model in brief

The execution sandbox runs **only code already present in the snippet registry**, selected by id. The API never accepts arbitrary source code from a client. Each run happens in a fresh Node.js worker thread with the process environment scrubbed, a hard wall-clock timeout, and a heap cap. See [docs/architecture.md](docs/architecture.md#execution-sandbox--srcsandboxexecutorts) for the full model and its explicit limits.

## Handling keys

Arbitrum Codex never asks for, transmits, or stores a private key. Snippets that need one read it from an environment variable you supply in your own environment. Never paste a key belonging to a funded mainnet account into any snippet, on this platform or elsewhere.
