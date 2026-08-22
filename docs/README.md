# Arbitrum Codex Documentation

Arbitrum Codex is a library of production-ready Arbitrum code templates, each available in an `ethers.js` and a `web3.js` variant, and each runnable in the browser against live Arbitrum networks without any local setup.

## Start here

| If you want to… | Read |
|---|---|
| Use the platform and run your first snippet | [Getting Started](getting-started.md) |
| Find the snippet you need and know what it requires | [Snippet Catalog](snippet-catalog.md) |
| Put a snippet into your own project | [Integration Guide](integration-guide.md) |
| Call the API from your own tooling | [API Reference](api-reference.md) |
| Understand how the platform works internally | [Architecture](architecture.md) |
| Contribute a snippet | [Authoring Snippets](authoring-snippets.md) · [CONTRIBUTING.md](../CONTRIBUTING.md) |
| Run your own instance | [Deployment](deployment.md) |
| Fix an error you hit | [Troubleshooting](troubleshooting.md) |

## What the platform is made of

```
codex-scripts/    29 snippets × {ethers, web3} + 1 Solidity contract — the library itself
codex-backend/    Express + TypeScript API: snippet registry, categories, sandboxed execution
codex-frontend/   Next.js 16 interface: discovery, search, syntax highlighting, copy, run
```

The three parts are independent. The snippets in `codex-scripts/` are plain Node.js files that run on their own with `node <file>.js` — the backend and frontend exist to make them discoverable and runnable without a local setup.

## Conventions used throughout

- **Snippet id** — `NNN_PascalCaseName`, e.g. `011_TimeboostAuctionHistory`. The number is stable and is what the API and the UI address a snippet by.
- **Variant** — `ethers`, `web3`, or `solidity`. The first two are executable; Solidity is display-only.
- **Default network** — Arbitrum One (`https://arb1.arbitrum.io/rpc`, chain id 42161) unless a snippet says otherwise. Arbitrum Sepolia is chain id 421614 at `https://sepolia-rollup.arbitrum.io/rpc`.
