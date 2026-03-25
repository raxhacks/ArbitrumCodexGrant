"use client";

import { useEffect, useRef, useState } from "react";
import Prism from "prismjs";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-solidity";

interface CodeBlockProps {
  code: string;
  language: "javascript" | "solidity";
}

export default function CodeBlock({ code, language }: CodeBlockProps) {
  const codeRef = useRef<HTMLElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (codeRef.current) Prism.highlightElement(codeRef.current);
  }, [code, language]);

  function handleCopy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const lineCount = code.split("\n").length;

  return (
    <div className="relative overflow-hidden">
      <div
        className="flex items-center justify-between px-5 py-2.5"
        style={{
          background: "rgba(255,255,255,0.015)",
          borderTop: "1px solid var(--border-dim)",
          borderBottom: "1px solid var(--border-dim)",
        }}
      >
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/30" />
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/30" />
            <span className="w-2.5 h-2.5 rounded-full bg-green-500/30" />
          </div>
          <span className="text-[10px] font-mono" style={{ color: "var(--text-dim)" }}>
            {language} — {lineCount} lines
          </span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-semibold rounded-lg cursor-pointer"
          style={{
            background: copied ? "rgba(45,156,219,0.12)" : "rgba(255,255,255,0.04)",
            color: copied ? "var(--arb-sky)" : "var(--text-secondary)",
            border: `1px solid ${copied ? "rgba(45,156,219,0.25)" : "var(--border-mid)"}`,
          }}
        >
          {copied ? (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Copied
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy code
            </>
          )}
        </button>
      </div>
      <pre className={`language-${language}`} style={{ maxHeight: "520px" }}>
        <code ref={codeRef} className={`language-${language}`}>
          {code}
        </code>
      </pre>
    </div>
  );
}
