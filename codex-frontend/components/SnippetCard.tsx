"use client";

import { useState } from "react";
import type { Snippet, VariantKey } from "@/lib/snippets";
import CodeBlock from "./CodeBlock";

interface SnippetCardProps {
  snippet: Snippet;
  isOpen: boolean;
  onToggle: () => void;
}

const variantStyle: Record<VariantKey, { bg: string; text: string; active: string }> = {
  ethers: { bg: "rgba(139,92,246,0.06)", text: "#a78bfa", active: "rgba(139,92,246,0.12)" },
  web3: { bg: "rgba(251,191,36,0.06)", text: "#fbbf24", active: "rgba(251,191,36,0.12)" },
  solidity: { bg: "rgba(16,185,129,0.06)", text: "#34d399", active: "rgba(16,185,129,0.12)" },
};

const variantLabel: Record<VariantKey, string> = {
  ethers: "ethers.js",
  web3: "web3.js",
  solidity: "Solidity",
};

export default function SnippetCard({ snippet, isOpen, onToggle }: SnippetCardProps) {
  const variants = Object.keys(snippet.variants) as VariantKey[];
  const [selected, setSelected] = useState<VariantKey>(variants[0]);

  const code = snippet.variants[selected] || "";
  const lang = selected === "solidity" ? "solidity" : "javascript";
  const preview = code.split("\n").slice(0, 3).join("\n");

  return (
    <div
      className="rounded-2xl overflow-hidden group"
      style={{
        background: isOpen ? "var(--bg-elevated)" : "var(--bg-card)",
        border: isOpen ? "2px solid rgba(45,156,219,0.2)" : "2px solid var(--border-dim)",
        boxShadow: isOpen
          ? "0 8px 32px rgba(0,0,0,0.3), 0 0 0 1px rgba(45,156,219,0.05)"
          : "0 2px 8px rgba(0,0,0,0.15)",
      }}
    >
      <div
        className="px-6 pt-5 pb-4 cursor-pointer flex flex-col"
        onClick={onToggle}
        style={{ minHeight: isOpen ? "auto" : "170px" }}
      >
        <div className="flex items-start justify-between gap-4 flex-1">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-3">
              <span
                className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-md"
                style={{
                  background: "rgba(45,156,219,0.08)",
                  color: "var(--arb-blue)",
                  border: "1px solid rgba(45,156,219,0.1)",
                }}
              >
                #{snippet.id}
              </span>
              {!isOpen && variants.map((v) => (
                <span
                  key={v}
                  className="text-[9px] font-mono font-semibold px-2 py-0.5 rounded-md"
                  style={{ background: variantStyle[v].bg, color: variantStyle[v].text }}
                >
                  {variantLabel[v]}
                </span>
              ))}
            </div>

            <h3 className="text-white font-semibold text-[15px] leading-tight mb-1.5 line-clamp-1 group-hover:text-[var(--arb-sky)]">
              {snippet.title}
            </h3>
            <p className="text-[13px] leading-relaxed line-clamp-2" style={{ color: "var(--text-secondary)" }}>
              {snippet.description}
            </p>
          </div>

          <button
            className="mt-1 shrink-0 w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer"
            style={{
              background: isOpen ? "rgba(45,156,219,0.1)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${isOpen ? "rgba(45,156,219,0.15)" : "var(--border-dim)"}`,
            }}
          >
            <svg
              className={`w-4 h-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
              style={{ color: isOpen ? "var(--arb-blue)" : "var(--text-dim)" }}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {!isOpen && (
          <div
            className="mt-auto pt-3 rounded-xl overflow-hidden font-mono text-[11px] leading-relaxed px-4 py-2.5"
            style={{
              background: "var(--bg-code)",
              color: "var(--text-dim)",
              maxHeight: "3.5rem",
              border: "1px solid var(--border-dim)",
            }}
          >
            <pre className="whitespace-pre overflow-hidden">{preview}</pre>
          </div>
        )}
      </div>

      {isOpen && (
        <div>
          {variants.length > 1 && (
            <div
              className="flex gap-1 px-4 py-2"
              style={{ background: "rgba(0,0,0,0.15)", borderTop: "1px solid var(--border-dim)" }}
            >
              {variants.map((v) => {
                const active = selected === v;
                const s = variantStyle[v];
                return (
                  <button
                    key={v}
                    onClick={(e) => { e.stopPropagation(); setSelected(v); }}
                    className="px-5 py-2 text-xs font-semibold rounded-lg cursor-pointer"
                    style={{
                      background: active ? s.active : "transparent",
                      color: active ? s.text : "var(--text-dim)",
                      border: active ? `1px solid ${s.text}25` : "1px solid transparent",
                    }}
                  >
                    {variantLabel[v]}
                  </button>
                );
              })}
            </div>
          )}
          <CodeBlock code={code} language={lang} />
        </div>
      )}
    </div>
  );
}
