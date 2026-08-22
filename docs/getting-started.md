# Getting Started

Three ways to use Arbitrum Codex, from least to most setup.

---

## 1. Use a snippet in the browser

No installation. Open the platform, go to **Snippets**, and you get the full library as cards.

**Find it.** Filter by category — Stylus & DeFi, Timeboost, Arbitrum Infrastructure, Wallet & Signing, Smart Contracts, RPC & Blocks — or type in the search box, which matches snippet id, title, and description.

**Read it.** Click a card to expand it. You get the full source with syntax highlighting, and a toggle between the **ethers.js** and **web3.js** variants of the same behaviour. Every snippet that has both is written so the two produce comparable output — pick whichever library your project already uses.

**Run it.** Press **Run**. The snippet executes on the server in an isolated sandbox against live Arbitrum, and the console output appears below the code as it would in your terminal, along with a status badge (`ok`, `error`, `timeout`, `memory`) and the wall-clock duration.

**Copy it.** **Copy code** puts the currently selected variant on your clipboard, ready to paste into your project.

### What Run does and does not do

- It runs the snippet exactly as published, on Arbitrum One by default. Nothing you type in the browser is injected into the code.
- Snippets that spend funds default to a **dry run** — they simulate and report gas, then stop before broadcasting.
- Snippets that need a private key or a specific contract address will report a clear error instead of doing something surprising. Those are copy-and-edit templates; see [the catalog](snippet-catalog.md) for which ones and what they need.
- Solidity snippets have no Run button. They are contract source to compile and deploy yourself.
- Runs are rate limited (20 per minute per IP by default). Hitting it gives you a "Rate limit reached" message; wait a minute.

---

## 2. Run a snippet locally

Every file in `codex-scripts/` is a standalone Node.js script with no framework around it.

```bash
git clone https://github.com/raxhacks/ArbitrumCodexGrant.git
cd ArbitrumCodexGrant/codex-scripts
npm install
node 025_GetBlockNumber_ethers.js
```

Requires Node.js 20 or newer. Snippets that take input read it from environment variables:

```bash
CONTRACT_ADDRESS=0x912CE59144191C1204E64559FE8253a0e49E6548 \
  node 022_ReadSmartContract_ethers.js
```

The [Snippet Catalog](snippet-catalog.md) lists every variable each snippet reads and what it defaults to.

---

## 3. Run the whole platform locally

Useful if you are contributing, or want the library pointed at your own RPC endpoints. Start the backend first — the frontend fetches everything from it.

### Backend

```bash
cd codex-backend
npm install
cp .env.example .env       # adjust PORT, CORS_ORIGIN, RPC URLs as needed
npm run dev                # http://localhost:3001
```

Check it came up:

```bash
curl http://localhost:3001/api/health
# {"status":"ok","uptime":1.7}
```

### Frontend

```bash
cd codex-frontend
npm install
npm run dev                # http://localhost:3000
```

If the backend is not on `http://localhost:3001`, point the frontend at it:

```bash
echo "NEXT_PUBLIC_API_URL=http://localhost:3001" > codex-frontend/.env.local
```

Open <http://localhost:3000>. If the snippet list shows an error instead of cards, the frontend cannot reach the backend — check that it is running and that `CORS_ORIGIN` in `codex-backend/.env` includes the frontend's origin. [Troubleshooting](troubleshooting.md) covers the rest.

---

## Next steps

- [Snippet Catalog](snippet-catalog.md) — what exists and what each snippet needs.
- [Integration Guide](integration-guide.md) — turning a snippet into part of your own application.
- [API Reference](api-reference.md) — driving the library from your own tooling.
