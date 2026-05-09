"use client";

import { useState, useMemo } from "react";
import { useSnippets } from "@/lib/useSnippets";
import type { Snippet } from "@/lib/api";
import SnippetCard from "@/components/SnippetCard";

const categoryIcons: Record<string, string> = {
  "Stylus & DeFi": "S",
  Timeboost: "T",
  "Arbitrum Infrastructure": "A",
  "Wallet & Signing": "W",
  "Smart Contracts": "C",
  "RPC & Blocks": "R",
};

const categoryDesc: Record<string, string> = {
  "Stylus & DeFi":
    "Everything related to Arbitrum's Stylus cache bidding system and on-chain DeFi primitives. Covers cache bid submission, reading CacheManager state, and pulling live ARB prices from Chainlink.",
  Timeboost:
    "The full Timeboost express lane auction lifecycle. From detecting whether it's enabled on a chain, to querying rounds, decoding auction txs, placing bids, watching winners, computing optimal strategies, and reviewing past results.",
  "Arbitrum Infrastructure":
    "Under-the-hood Arbitrum plumbing. Gas cost breakdowns via ArbGasInfo, retryable ticket tracking between L1 and L2, block mapping through NodeInterface, and reading raw delayed inbox data.",
  "Wallet & Signing":
    "Wallet operations and off-chain signing. Generate fresh keypairs, produce and verify EIP-712 typed signatures, do gasless ERC-20 permit flows, and hook up a wallet to an Arbitrum endpoint.",
  "Smart Contracts":
    "Covers the full contract interaction surface: reading raw storage, calling view functions, sending state-changing txs with simulation, deploying bytecode, verifying source on Blockscout, and subscribing to events.",
  "RPC & Blocks":
    "The basics you need before doing anything else. Set up an RPC connection with automatic failover, grab block numbers, pull full block data, look up transactions, and benchmark endpoint latency.",
};

type Page = "about" | "snippets";

const NAV_ITEMS: { id: Page; label: string; iconPath: string }[] = [
  {
    id: "about",
    label: "Arbitrum Codex",
    iconPath: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
  },
  {
    id: "snippets",
    label: "Snippets",
    iconPath: "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4",
  },
];

export default function Home() {
  const { snippets, categories, categoryNames, isLoading, error, reload } = useSnippets();

  const fallbackCategory = categoryNames[0] ?? "";
  const [page, setPage] = useState<Page>("about");
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const effectiveCategory = activeCategory || fallbackCategory;

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const cat of categories) c[cat.name] = cat.count;
    return c;
  }, [categories]);

  const filtered = useMemo<Snippet[]>(() => {
    if (search.trim()) {
      const q = search.toLowerCase();
      return snippets.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q)
      );
    }
    return snippets.filter((s) => s.category === effectiveCategory);
  }, [activeCategory, effectiveCategory, search, snippets]);

  return (
    <div className="flex h-screen overflow-hidden relative">
      <div
        className="fixed top-[-200px] left-1/3 w-[900px] h-[900px] rounded-full blur-[200px] opacity-[0.07] pointer-events-none"
        style={{ background: "var(--arb-blue)" }}
      />
      <div
        className="fixed bottom-[-300px] right-[-100px] w-[600px] h-[600px] rounded-full blur-[180px] opacity-[0.04] pointer-events-none"
        style={{ background: "#a78bfa" }}
      />

      <aside
        className="relative w-60 shrink-0 flex flex-col"
        style={{ background: "var(--bg-secondary)", borderRight: "1px solid var(--border-dim)" }}
      >
        <div className="px-6 pt-7 pb-6" style={{ borderBottom: "1px solid var(--border-dim)" }}>
          <h1 className="text-lg font-extrabold tracking-wide uppercase leading-tight">
            <span className="text-white">ARBITRUM</span>
            <span className="ml-1.5" style={{ color: "var(--arb-sky)" }}>CODEX</span>
          </h1>
          <p className="text-[11px] mt-1.5 font-medium" style={{ color: "var(--text-dim)" }}>
            Developer Reference
          </p>
        </div>

        <nav className="px-3 pt-4 flex-1">
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] px-3 mb-3" style={{ color: "var(--text-dim)" }}>
            Navigation
          </p>
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const active = page === item.id;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => setPage(item.id)}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-[13px] font-semibold cursor-pointer"
                    style={{
                      background: active ? "rgba(45,156,219,0.08)" : "transparent",
                      border: active ? "1px solid rgba(45,156,219,0.12)" : "1px solid transparent",
                      color: active ? "var(--arb-sky)" : "var(--text-secondary)",
                    }}
                  >
                    <span
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{
                        background: active ? "rgba(45,156,219,0.12)" : "rgba(255,255,255,0.03)",
                        color: active ? "var(--arb-sky)" : "var(--text-dim)",
                      }}
                    >
                      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d={item.iconPath} />
                      </svg>
                    </span>
                    {item.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="px-6 py-5" style={{ borderTop: "1px solid var(--border-dim)" }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400/60" />
            <span className="text-[10px] font-semibold" style={{ color: "var(--text-dim)" }}>
              Arbitrum One Mainnet
            </span>
          </div>
          <p className="text-[10px] leading-relaxed" style={{ color: "var(--text-dim)" }}>
            ethers.js + web3.js dual support
          </p>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto relative">
        <div className="absolute top-6 right-8 z-10">
          <img src="/logo.svg" alt="Arbitrum Codex" className="w-32 h-32 opacity-80 hover:opacity-100 transition-opacity" />
        </div>

        {page === "about" ? <AboutView /> : (
          <SnippetsView
            category={effectiveCategory}
            setCategory={setActiveCategory}
            search={search}
            setSearch={(s: string) => { setSearch(s); setExpandedId(null); }}
            counts={counts}
            results={filtered}
            categoryNames={categoryNames}
            expandedId={expandedId}
            setExpandedId={setExpandedId}
            isLoading={isLoading}
            error={error}
            reload={reload}
          />
        )}
      </main>
    </div>
  );
}

const featureCards = [
  {
    badge: "L2", badgeBg: "rgba(45,156,219,0.12)", badgeColor: "var(--arb-sky)",
    title: "Leading Layer 2",
    text: "Sub-cent transaction costs, 250ms block times, and native fraud proofs backed by Ethereum security. The largest L2 ecosystem by TVL and developer activity.",
  },
  {
    badge: "S+T", badgeBg: "rgba(139,92,246,0.12)", badgeColor: "#a78bfa",
    title: "Stylus + Timeboost",
    text: "Stylus brings WASM smart contracts (Rust, C, C++) to Arbitrum. Timeboost introduces express lane auctions for priority transaction ordering. Both are covered here with working examples.",
  },
  {
    badge: "2x", badgeBg: "rgba(16,185,129,0.12)", badgeColor: "#34d399",
    title: "Dual Library Support",
    text: "Pick your stack. Every snippet ships in both ethers.js and web3.js so you can drop it straight into whatever you're already using.",
  },
];

const sectionCards = [
  { letter: "S", color: "var(--arb-blue)", name: "Stylus & DeFi", text: "Interact with the Stylus cache system — submit bids to keep WASM programs initialized, read cache state, and fetch ARB token prices from Chainlink oracles." },
  { letter: "T", color: "#a78bfa", name: "Timeboost", text: "Full coverage of the Timeboost express lane auction system — detect availability, query state, decode transactions, submit bids, monitor winners, and analyze history." },
  { letter: "A", color: "#34d399", name: "Arbitrum Infrastructure", text: "Low-level Arbitrum infrastructure — read gas pricing from the ArbGasInfo precompile, track L1-to-L2 retryable tickets, map blocks across layers, and inspect the delayed inbox." },
  { letter: "W", color: "#fbbf24", name: "Wallet & Signing", text: "Key management and cryptographic operations — generate wallets, sign EIP-712 typed data, execute gasless ERC-20 permit transfers, and connect wallets to the network." },
  { letter: "C", color: "#f87171", name: "Smart Contracts", text: "End-to-end contract interaction — read storage slots, call view functions, send write transactions with simulation, deploy from bytecode, verify on Blockscout, and subscribe to events." },
  { letter: "R", color: "#22d3ee", name: "RPC & Blocks", text: "Foundational RPC operations — initialize connections with failover and benchmarking, fetch block numbers and details, look up transactions by hash, and measure endpoint latency." },
];

function AboutView() {
  return (
    <div className="max-w-5xl mx-auto px-12 py-20">
      <div className="mb-20">
        <div className="flex items-center gap-4 mb-6">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, rgba(45,156,219,0.2), rgba(86,204,242,0.1))",
              border: "1px solid rgba(45,156,219,0.15)",
            }}
          >
            <svg className="w-7 h-7" style={{ color: "var(--arb-sky)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h2 className="text-4xl font-extrabold tracking-tight uppercase">
            <span className="text-white">ARBITRUM</span>
            <span className="ml-3" style={{ color: "var(--arb-sky)" }}>CODEX</span>
          </h2>
        </div>
        <p className="text-lg leading-[1.9] max-w-3xl" style={{ color: "var(--text-secondary)" }}>
          The developer reference for building on Arbitrum — the leading Layer 2
          scaling solution for Ethereum. Low fees, fast finality, and full EVM
          compatibility make it the strongest foundation for production dApps.
          Every snippet ships in both ethers.js and web3.js, ready for immediate integration.
        </p>
      </div>

      <div className="mb-20">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-[2px] rounded-full" style={{ background: "var(--arb-blue)" }} />
          <h3 className="text-sm font-bold uppercase tracking-[0.15em]" style={{ color: "var(--arb-blue)" }}>
            Why Build on Arbitrum
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {featureCards.map((c) => (
            <div
              key={c.badge}
              className="rounded-2xl px-7 py-7"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border-dim)", boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}
            >
              <div className="flex items-center gap-3 mb-4">
                <span
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold"
                  style={{ background: c.badgeBg, color: c.badgeColor }}
                >{c.badge}</span>
                <h4 className="text-base font-bold text-white">{c.title}</h4>
              </div>
              <p className="text-[15px] leading-[1.8]" style={{ color: "var(--text-secondary)" }}>{c.text}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-[2px] rounded-full" style={{ background: "var(--arb-blue)" }} />
          <h3 className="text-sm font-bold uppercase tracking-[0.15em]" style={{ color: "var(--arb-blue)" }}>
            What&apos;s Inside
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {sectionCards.map((s) => (
            <div
              key={s.letter}
              className="rounded-2xl px-7 py-7"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border-dim)", boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}
            >
              <div className="flex items-center gap-3 mb-3">
                <span
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold"
                  style={{ background: `${s.color}18`, color: s.color }}
                >{s.letter}</span>
                <h4 className="text-base font-bold text-white">{s.name}</h4>
              </div>
              <p className="text-[15px] leading-[1.8]" style={{ color: "var(--text-secondary)" }}>{s.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface SnippetsViewProps {
  category: string;
  setCategory: (c: string) => void;
  search: string;
  setSearch: (s: string) => void;
  counts: Record<string, number>;
  results: Snippet[];
  categoryNames: string[];
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
  isLoading: boolean;
  error: string | null;
  reload: () => void;
}

function SnippetsView({ category, setCategory, search, setSearch, counts, results, categoryNames, expandedId, setExpandedId, isLoading, error, reload }: SnippetsViewProps) {
  return (
    <div className="max-w-7xl mx-auto px-12 py-16">
      <div className="flex items-center gap-4 mb-12">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{
            background: "linear-gradient(135deg, rgba(45,156,219,0.2), rgba(86,204,242,0.1))",
            border: "1px solid rgba(45,156,219,0.15)",
          }}
        >
          <svg className="w-7 h-7" style={{ color: "var(--arb-sky)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
        </div>
        <h2 className="text-4xl font-extrabold tracking-tight uppercase">
          <span className="text-white">ARBITRUM</span>
          <span className="ml-3" style={{ color: "var(--arb-sky)" }}>CODEX</span>
        </h2>
      </div>

      <div className="mb-10">
        <div className="relative">
          <svg
            className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5"
            style={{ color: "var(--text-dim)" }}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search snippets by name, description, or keyword..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-16 pr-8 py-5 text-base rounded-2xl focus:outline-none"
            style={{
              background: "var(--bg-card)",
              border: "2px solid var(--border-mid)",
              color: "var(--text-primary)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "rgba(45,156,219,0.35)";
              e.target.style.boxShadow = "0 2px 16px rgba(45,156,219,0.08)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "var(--border-mid)";
              e.target.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)";
            }}
          />
        </div>
      </div>

      <div className="flex flex-nowrap justify-center gap-2.5 py-2 mb-10">
        {categoryNames.map((cat) => {
          const active = category === cat && !search.trim();
          return (
            <button
              key={cat}
              onClick={() => { setCategory(cat); setSearch(""); setExpandedId(null); }}
              className="flex items-center gap-2 px-5 py-3 rounded-xl text-[13px] font-semibold cursor-pointer whitespace-nowrap"
              style={{
                background: active ? "rgba(45,156,219,0.1)" : "var(--bg-card)",
                border: active ? "1px solid rgba(45,156,219,0.2)" : "1px solid var(--border-dim)",
                color: active ? "var(--arb-sky)" : "var(--text-secondary)",
                boxShadow: active ? "0 0 12px rgba(45,156,219,0.06)" : "none",
              }}
            >
              <span
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold"
                style={{
                  background: active ? "var(--arb-blue)" : "rgba(255,255,255,0.04)",
                  color: active ? "#fff" : "var(--text-dim)",
                }}
              >{categoryIcons[cat]}</span>
              <span>{cat}</span>
              <span
                className="text-[11px] font-mono px-2 py-0.5 rounded-md"
                style={{
                  background: active ? "rgba(45,156,219,0.15)" : "rgba(255,255,255,0.03)",
                  color: active ? "var(--arb-blue)" : "var(--text-dim)",
                }}
              >{counts[cat]}</span>
            </button>
          );
        })}
      </div>

      <div className="h-px mb-10" style={{ background: "var(--border-dim)" }} />

      <div className="mb-8">
        <h3 className="text-xl font-bold text-white">
          {search.trim() ? `Results for "${search}"` : category}
        </h3>
        {!search.trim() && categoryDesc[category] && (
          <p className="text-2xl leading-[1.8] mt-4" style={{ color: "var(--text-secondary)" }}>
            {categoryDesc[category]}
          </p>
        )}
        <p className="text-sm mt-2 font-medium" style={{ color: "var(--text-dim)" }}>
          {results.length} snippet{results.length !== 1 ? "s" : ""} available
        </p>
      </div>

      {error ? (
        <div className="text-center py-24">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}
          >
            <svg className="w-7 h-7" style={{ color: "#f87171" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <p className="text-sm font-medium mb-3" style={{ color: "#f87171" }}>Could not load snippets: {error}</p>
          <button
            onClick={reload}
            className="px-4 py-2 text-xs font-bold rounded-lg cursor-pointer"
            style={{ background: "rgba(45,156,219,0.12)", color: "var(--arb-sky)", border: "1px solid rgba(45,156,219,0.2)" }}
          >Retry</button>
        </div>
      ) : isLoading ? (
        <div className="text-center py-24">
          <div className="inline-block w-8 h-8 rounded-full border-2 border-current border-r-transparent animate-spin mb-4" style={{ color: "var(--arb-sky)" }} />
          <p className="text-sm font-medium" style={{ color: "var(--text-dim)" }}>Loading snippets…</p>
        </div>
      ) : results.length > 0 ? (
        expandedId ? (
          <div>
            {results.filter((s) => s.id === expandedId).map((s) => (
              <SnippetCard key={s.id} snippet={s} isOpen onToggle={() => setExpandedId(null)} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {results.map((s) => (
              <SnippetCard key={s.id} snippet={s} isOpen={false} onToggle={() => setExpandedId(s.id)} />
            ))}
          </div>
        )
      ) : (
        <div className="text-center py-24">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-dim)" }}
          >
            <svg className="w-7 h-7" style={{ color: "var(--text-dim)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm font-medium" style={{ color: "var(--text-dim)" }}>No snippets match your search.</p>
        </div>
      )}
    </div>
  );
}
