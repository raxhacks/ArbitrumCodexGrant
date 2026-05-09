"use client";

import { useEffect, useRef, useState } from "react";
import { runSnippet, type RunResult, type Snippet, type VariantKey } from "@/lib/api";
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

const statusStyle: Record<RunResult["status"], { bg: string; color: string; label: string }> = {
  ok: { bg: "rgba(16,185,129,0.12)", color: "#34d399", label: "ok" },
  error: { bg: "rgba(239,68,68,0.12)", color: "#f87171", label: "error" },
  timeout: { bg: "rgba(251,191,36,0.12)", color: "#fbbf24", label: "timeout" },
  memory: { bg: "rgba(251,191,36,0.12)", color: "#fbbf24", label: "memory" },
};

const logLevelColor: Record<string, string> = {
  log: "var(--text-secondary)",
  info: "#56ccf2",
  warn: "#fbbf24",
  error: "#f87171",
  debug: "var(--text-dim)",
};

export default function SnippetCard({ snippet, isOpen, onToggle }: SnippetCardProps) {
  const variants = Object.keys(snippet.variants) as VariantKey[];
  const [selected, setSelected] = useState<VariantKey>(variants[0]);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setResult(null);
    setRunError(null);
  }, [selected, snippet.id]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const code = snippet.variants[selected] || "";
  const lang = selected === "solidity" ? "solidity" : "javascript";
  const preview = code.split("\n").slice(0, 3).join("\n");
  const isRunnable = selected === "ethers" || selected === "web3";

  const handleRun = async () => {
    if (!isRunnable || running) return;
    setRunning(true);
    setRunError(null);
    setResult(null);

    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    try {
      const r = await runSnippet(snippet.id, selected, { signal: controller.signal });
      setResult(r);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setRunError((err as Error).message);
    } finally {
      setRunning(false);
    }
  };

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
                #{snippet.number}
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
          <div
            className="flex items-center gap-1 px-4 py-2"
            style={{ background: "rgba(0,0,0,0.15)", borderTop: "1px solid var(--border-dim)" }}
          >
            {variants.length > 1 ? (
              variants.map((v) => {
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
              })
            ) : (
              <span
                className="px-5 py-2 text-xs font-semibold rounded-lg"
                style={{ color: variantStyle[selected].text }}
              >
                {variantLabel[selected]}
              </span>
            )}

            {isRunnable && (
              <button
                onClick={(e) => { e.stopPropagation(); handleRun(); }}
                disabled={running}
                className="ml-auto flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg cursor-pointer"
                style={{
                  background: running ? "rgba(45,156,219,0.06)" : "rgba(45,156,219,0.12)",
                  color: running ? "var(--text-dim)" : "var(--arb-sky)",
                  border: "1px solid rgba(45,156,219,0.2)",
                  opacity: running ? 0.7 : 1,
                  cursor: running ? "wait" : "pointer",
                }}
              >
                {running ? (
                  <>
                    <span
                      className="inline-block w-3 h-3 rounded-full border-2 border-current border-r-transparent animate-spin"
                    />
                    Running…
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    Run live
                  </>
                )}
              </button>
            )}
          </div>

          <CodeBlock code={code} language={lang} />

          {(running || result || runError) && (
            <div
              className="px-5 py-4"
              style={{
                background: "rgba(0,0,0,0.2)",
                borderTop: "1px solid var(--border-dim)",
              }}
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: "var(--text-dim)" }}>
                  Live output
                </span>
                {result && (
                  <>
                    <span
                      className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md"
                      style={{
                        background: statusStyle[result.status].bg,
                        color: statusStyle[result.status].color,
                      }}
                    >
                      {statusStyle[result.status].label}
                    </span>
                    <span className="text-[11px] font-mono" style={{ color: "var(--text-dim)" }}>
                      {result.durationMs}ms
                    </span>
                    {result.logs.length > 0 && (
                      <span className="text-[11px] font-mono" style={{ color: "var(--text-dim)" }}>
                        · {result.logs.length} log{result.logs.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </>
                )}
                {running && (
                  <span className="text-[11px]" style={{ color: "var(--text-dim)" }}>
                    Executing in sandbox…
                  </span>
                )}
              </div>

              {runError && (
                <div
                  className="rounded-lg px-3 py-2 text-[12px] font-mono leading-relaxed"
                  style={{
                    background: "rgba(239,68,68,0.08)",
                    color: "#f87171",
                    border: "1px solid rgba(239,68,68,0.2)",
                  }}
                >
                  {runError}
                </div>
              )}

              {result && (
                <div
                  className="rounded-lg overflow-auto font-mono text-[12px] leading-[1.6]"
                  style={{
                    background: "var(--bg-code)",
                    border: "1px solid var(--border-dim)",
                    maxHeight: "16rem",
                  }}
                >
                  {result.logs.length === 0 && !result.error ? (
                    <div className="px-3 py-2" style={{ color: "var(--text-dim)" }}>
                      (no output)
                    </div>
                  ) : (
                    <>
                      {result.logs.map((log, idx) => (
                        <div
                          key={idx}
                          className="px-3 py-1 flex gap-3"
                          style={{
                            borderBottom: idx < result.logs.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none",
                          }}
                        >
                          <span style={{ color: "var(--text-dim)", minWidth: "3.5rem" }}>
                            +{log.ts}ms
                          </span>
                          <span
                            className="uppercase text-[10px] font-bold pt-0.5"
                            style={{ color: logLevelColor[log.level] ?? "var(--text-dim)", minWidth: "2.5rem" }}
                          >
                            {log.level}
                          </span>
                          <span style={{ color: logLevelColor[log.level] ?? "var(--text-secondary)", whiteSpace: "pre-wrap" }}>
                            {log.message}
                          </span>
                        </div>
                      ))}
                      {result.error && (
                        <div
                          className="px-3 py-2 whitespace-pre-wrap"
                          style={{ color: "#f87171", borderTop: "1px solid rgba(239,68,68,0.15)" }}
                        >
                          {result.error}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
