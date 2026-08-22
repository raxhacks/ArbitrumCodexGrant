# Arbitrum Codex

Arbitrum Codex is a comprehensive developer resource platform designed to accelerate onboarding and streamline implementation for blockchain developers at all levels. The platform serves as a dual-purpose reference hub offering both Arbitrum-specific implementations and foundational blockchain development patterns, with a unique focus on interactive validation through live testing environments.

Every code snippet on Arbitrum Codex comes with an integrated live testing platform, allowing developers to experiment and validate code directly in their browser before deploying to production.

## Tech Stack

**Frontend:**
- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Prism.js (syntax highlighting)

**Scripts:**
- ethers.js v6
- web3.js v4
- Solidity

## Project Structure

```
ArbitrumCodexGrant/
├── codex-frontend/       # Next.js frontend application
│   ├── app/              # App Router pages & layout
│   ├── components/       # React components (SnippetCard, CodeBlock)
│   ├── lib/              # API client & React hooks
│   └── public/           # Static assets (logo)
├── codex-backend/        # Express + TypeScript API
│   ├── src/
│   │   ├── routes/       # /api/snippets, /api/run, /api/categories
│   │   ├── sandbox/      # Worker-thread snippet executor
│   │   ├── snippets/     # Registry & category metadata
│   │   ├── config.ts     # Zod-validated env config
│   │   ├── logger.ts     # pino logger
│   │   └── server.ts     # Express entry point
│   ├── scripts/          # Build helpers (snippet sync, etc.)
│   └── tests/            # Vitest suite (executor, registry, routes)
├── codex-scripts/        # Production-ready code templates
│   ├── 001-029 ethers.js # ethers.js implementations
│   ├── 001-029 web3.js   # web3.js implementations
│   └── 001 .sol          # Solidity contracts
├── docs/                 # Technical documentation & guides
├── CONTRIBUTING.md       # Contribution process & snippet contract
├── SECURITY.md           # Vulnerability reporting & security model
└── README.md
```

## Getting Started

For the live testing flow, start the backend first, then the frontend.

### Backend

```bash
cd codex-backend
npm install
cp .env.example .env       # adjust PORT, CORS_ORIGIN, RPC URLs as needed
npm run dev                # http://localhost:3001
```

Available scripts:

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the API in watch mode (`tsx watch`) |
| `npm run build` | Type-check and emit to `dist/` |
| `npm start` | Run the compiled server |
| `npm test` | Run the Vitest suite |
| `npm run check` | Type-check only |

### Frontend

```bash
cd codex-frontend
npm install
# Optional: point at a non-default backend
# echo "NEXT_PUBLIC_API_URL=http://localhost:3001" > .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the platform.

### Scripts

The standalone snippets in `codex-scripts/` can also be run directly without the backend:

```bash
cd codex-scripts
npm install
node <script_name>.js
```

## Documentation

Full documentation lives in [`docs/`](docs/README.md).

| Guide | What it covers |
|---|---|
| [Getting Started](docs/getting-started.md) | Using the platform, running snippets locally, running the full stack |
| [Snippet Catalog](docs/snippet-catalog.md) | Every snippet, its variants, inputs, and whether it runs unmodified |
| [Integration Guide](docs/integration-guide.md) | Taking a snippet into your own application |
| [API Reference](docs/api-reference.md) | Every endpoint, request and response shape, and error code |
| [Architecture](docs/architecture.md) | How the registry, sandbox, API, and interface fit together |
| [Authoring Snippets](docs/authoring-snippets.md) | The contract a new snippet has to meet |
| [Deployment](docs/deployment.md) | Self-hosting the backend and frontend |
| [Troubleshooting](docs/troubleshooting.md) | Errors you may hit, and what they mean |

## Code Snippets

All snippets are available in both **ethers.js** and **web3.js** versions.

| # | Snippet | Category |
|---|---------|----------|
| 001 | ARB Price Oracle | DeFi / Oracles |
| 002 | Stylus Cache Bid Submit | Stylus |
| 003 | Stylus Cache Read | Stylus |
| 004 | Timeboost Full State | Timeboost |
| 005 | Timeboost Current State | Timeboost |
| 006 | Timeboost Detect | Timeboost |
| 007 | Timeboost Auction Decode | Timeboost |
| 008 | Timeboost Bid Submit | Timeboost |
| 009 | Timeboost Winner Monitor | Timeboost |
| 010 | Timeboost Optimal Bid | Timeboost |
| 011 | Timeboost Auction History | Timeboost |
| 012 | Arb Gas Info | Gas / Network |
| 013 | L1 to L2 Tx Status | Cross-Layer Messaging |
| 014 | L2 to L1 Block Mapping | Cross-Layer Messaging |
| 015 | Arb L2 Inbox Read | Cross-Layer Messaging |
| 016 | Generate Wallet | Wallet Operations |
| 017 | Sign EIP-712 | Wallet Operations |
| 018 | Read Storage Slot | Smart Contracts |
| 019 | Verify on Blockscout | Smart Contracts |
| 020 | ERC-20 Permit Transfer | Token Standards |
| 021 | Write Smart Contract | Smart Contracts |
| 022 | Read Smart Contract | Smart Contracts |
| 023 | Connect Wallet | Wallet Operations |
| 024 | Init RPC | Network / RPC |
| 025 | Get Block Number | Network / RPC |
| 026 | Get Block Info | Network / RPC |
| 027 | Get Tx by Hash | Network / RPC |
| 028 | Listen Contract Events | Smart Contracts |
| 029 | Deploy Bytecode | Smart Contracts |

## Roadmap

| Milestone | Description | Status |
|-----------|-------------|--------|
| 1 | Code Snippet Library & Testing Infrastructure | Completed |
| 2 | Frontend Development | Completed |
| 3 | Backend Development | Completed |
| 4 | Fullstack Integration | Completed |
| 5 | Documentation & Grant Reporting | In progress |

### Milestone 1: Code Snippet Library & Testing Infrastructure

Complete GitHub repository with production-ready code templates for Arbitrum-specific implementations (Timeboost, Stylus cache system, ARB token integrations) and general blockchain patterns. All templates available in two library versions (ethers.js and web3.js) with reproducible testing environments and comprehensive documentation.

### Milestone 2: Frontend Development

Fully functional user interface with intuitive navigation, code discovery interface, one-click code copying, and integration points for live testing environments. Developer-centric UX/UI implementation with tags, searchbar, and improved logo.

### Milestone 3: Backend Development

Production-ready backend service powering snippet discovery and live in-browser code execution. RESTful API built with Express and TypeScript, exposing endpoints for snippet listing, single-snippet retrieval, category browsing, on-demand sandboxed execution, and health checks. Each snippet runs inside an isolated Node.js worker thread with hard timeout and memory limits, OOM detection, scrubbed environment variables, and captured console output. Hardened with Helmet, CORS allowlists, Zod-based request validation, per-route rate limiting, structured logging via pino, and comprehensive Vitest coverage across executor, registry, and HTTP routes.

### Milestone 4: Fullstack Integration

Fully integrated fullstack pipeline connecting the frontend interface to the backend API and execution sandbox. Snippets and categories are now fetched dynamically at runtime through a typed API client and a dedicated React hook with abort handling, loading state, and graceful error reporting. Each snippet card exposes a one-click Run action that executes the selected ethers.js or web3.js variant against the backend and renders the resulting logs and outputs directly in the browser, with developer-friendly handling for rate limits, missing variants, and timeouts.

### Milestone 5: Documentation & Grant Reporting

Complete documentation set covering the platform end to end, plus the protocols that let the library grow through community contribution. [`docs/`](docs/README.md) holds onboarding for first-time users, a full catalog of every snippet with its inputs and execution status, an integration guide for moving snippet code into production applications, a complete REST API reference, an architecture document covering the registry and execution sandbox with its explicit security boundary, an authoring guide defining the contract a new snippet must meet, a self-hosting deployment guide, and a troubleshooting reference. Community protocols are established through [CONTRIBUTING.md](CONTRIBUTING.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), [SECURITY.md](SECURITY.md), issue and pull request templates, and MIT licensing of the entire library.

## Contributing

New snippets, fixes, and platform improvements are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md) for the process and [Authoring Snippets](docs/authoring-snippets.md) for the technical contract every snippet has to meet.

Report security issues privately — see [SECURITY.md](SECURITY.md). Participation is governed by the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

MIT — see [LICENSE](LICENSE). The snippets are free to use in commercial and closed-source work.
