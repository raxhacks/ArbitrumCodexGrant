import { describe, it, expect } from "vitest";
import { runSnippet } from "../src/sandbox/executor.js";

describe("runSnippet", () => {
  it("captures console.log output and reports ok", async () => {
    const r = await runSnippet({
      code: 'console.log("hello", 1 + 1);',
      timeoutMs: 3000,
    });
    expect(r.status).toBe("ok");
    expect(r.logs).toHaveLength(1);
    expect(r.logs[0].message).toBe("hello 2");
  });

  it("surfaces thrown errors", async () => {
    const r = await runSnippet({
      code: 'throw new Error("boom");',
      timeoutMs: 2000,
    });
    expect(r.status).toBe("error");
    expect(r.error).toMatch(/boom/);
  });

  it("surfaces syntax errors", async () => {
    const r = await runSnippet({
      code: "this is not valid javascript;;;",
      timeoutMs: 2000,
    });
    expect(r.status).toBe("error");
    expect(r.error).toMatch(/SyntaxError/i);
  });

  it("times out infinite loops", async () => {
    const r = await runSnippet({
      code: "while (true) {}",
      timeoutMs: 600,
    });
    expect(r.status).toBe("timeout");
    expect(r.durationMs).toBeGreaterThanOrEqual(600);
    expect(r.durationMs).toBeLessThan(1500);
  });

  it("waits for fire-and-forget promises before exiting", async () => {
    const r = await runSnippet({
      code: `
        (async () => {
          await new Promise((res) => setTimeout(res, 100));
          console.log("late log");
        })();
      `,
      timeoutMs: 2000,
    });
    expect(r.status).toBe("ok");
    expect(r.logs.map((l) => l.message)).toContain("late log");
  });

  it("supports require('ethers') and works against live RPC", async () => {
    const r = await runSnippet({
      code: `
        const { ethers } = require('ethers');
        const provider = new ethers.JsonRpcProvider('https://arb1.arbitrum.io/rpc');
        const n = await provider.getBlockNumber();
        console.log('block', n);
      `,
      timeoutMs: 12000,
    });
    expect(r.status).toBe("ok");
    expect(r.logs[0]?.message).toMatch(/^block \d+/);
  });

  it("isolates process.env per invocation", async () => {
    process.env.HOST_SECRET = "should-not-leak";
    const r = await runSnippet({
      code: 'console.log("env:", JSON.stringify(Object.keys(process.env)));',
      env: { ALLOWED: "yes" },
      timeoutMs: 2000,
    });
    delete process.env.HOST_SECRET;
    expect(r.status).toBe("ok");
    const dump = r.logs[0].message;
    expect(dump).not.toMatch(/HOST_SECRET/);
    expect(dump).toMatch(/ALLOWED/);
  });
});
