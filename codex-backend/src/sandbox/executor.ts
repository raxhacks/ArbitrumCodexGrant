import { Worker } from "node:worker_threads";
import { config } from "../config.js";
import { logger } from "../logger.js";

export interface RunOptions {
  code: string;
  env?: Record<string, string>;
  timeoutMs?: number;
  memoryMb?: number;
}

export interface RunLog {
  level: string;
  message: string;
  ts: number;
}

export type RunStatus = "ok" | "error" | "timeout" | "memory";

export interface RunResult {
  status: RunStatus;
  logs: RunLog[];
  result?: string | null;
  error?: string;
  exitCode?: number;
  durationMs: number;
}

const RUNTIME_SRC = String.raw`
const { parentPort, workerData } = require("node:worker_threads");

const { code, env } = workerData;

for (const k of Object.keys(process.env)) delete process.env[k];
Object.assign(process.env, env);

const send = (type, payload) => parentPort.postMessage({ type, payload });

const stringify = (v) => {
  if (typeof v === "string") return v;
  if (v instanceof Error) return v.stack || v.message;
  try {
    return JSON.stringify(v, (_, val) => (typeof val === "bigint" ? val.toString() + "n" : val));
  } catch {
    return String(v);
  }
};

const captureLog = (level) => (...args) =>
  send("log", { level, message: args.map(stringify).join(" ") });

console.log = captureLog("log");
console.info = captureLog("info");
console.warn = captureLog("warn");
console.error = captureLog("error");
console.debug = captureLog("debug");

const _origExit = process.exit;
process.exit = (code) => {
  send("exit", { exitCode: code == null ? 0 : code });
  _origExit(0);
};

process.on("uncaughtException", (err) => {
  send("error", { message: err instanceof Error ? (err.stack || err.message) : String(err) });
});
process.on("unhandledRejection", (reason) => {
  send("error", {
    message: reason instanceof Error ? (reason.stack || reason.message) : String(reason),
  });
});

(async () => {
  try {
    const wrapped = "(async () => {\n" + code + "\n})()";
    const result = await eval(wrapped);
    if (result !== undefined) send("result", { value: stringify(result) });
  } catch (err) {
    send("error", { message: err instanceof Error ? (err.stack || err.message) : String(err) });
  }
})();
`;

const DEFAULT_ENV: Record<string, string> = {
  NODE_OPTIONS: "",
};

export async function runSnippet(opts: RunOptions): Promise<RunResult> {
  const timeoutMs = opts.timeoutMs ?? config.SANDBOX_TIMEOUT_MS;
  const memoryMb = opts.memoryMb ?? config.SANDBOX_MEMORY_MB;
  const env = { ...DEFAULT_ENV, ...(opts.env ?? {}) };

  const start = Date.now();
  const logs: RunLog[] = [];

  return await new Promise<RunResult>((resolve) => {
    let settled = false;
    const settle = (r: RunResult) => {
      if (settled) return;
      settled = true;
      worker.removeAllListeners();
      worker.terminate().catch(() => {});
      clearTimeout(timer);
      resolve(r);
    };

    const worker = new Worker(RUNTIME_SRC, {
      eval: true,
      workerData: { code: opts.code, env },
      resourceLimits: {
        maxOldGenerationSizeMb: memoryMb,
        maxYoungGenerationSizeMb: Math.min(32, Math.floor(memoryMb / 4)),
      },
      stdout: true,
      stderr: true,
    });

    const timer = setTimeout(() => {
      logger.warn({ timeoutMs }, "snippet execution timed out");
      settle({
        status: "timeout",
        logs,
        error: `execution exceeded ${timeoutMs}ms`,
        durationMs: Date.now() - start,
      });
    }, timeoutMs);

    let firstError: string | undefined;
    let lastResult: string | null = null;
    let explicitExitCode: number | undefined;

    worker.on("message", (msg: { type: string; payload?: unknown }) => {
      if (msg.type === "log") {
        const p = msg.payload as { level: string; message: string };
        logs.push({ level: p.level, message: p.message, ts: Date.now() - start });
      } else if (msg.type === "result") {
        const p = msg.payload as { value: string };
        lastResult = p.value;
      } else if (msg.type === "exit") {
        const p = msg.payload as { exitCode: number };
        explicitExitCode = p.exitCode;
      } else if (msg.type === "error") {
        const p = msg.payload as { message: string };
        if (!firstError) firstError = p.message;
      }
    });

    worker.on("error", (err) => {
      const message = err instanceof Error ? err.stack ?? err.message : String(err);
      const isOom = /JavaScript heap out of memory|Allocation failed/i.test(message);
      settle({
        status: isOom ? "memory" : "error",
        logs,
        error: message,
        durationMs: Date.now() - start,
      });
    });

    worker.on("exit", (code) => {
      if (settled) return;
      const ok = code === 0 && !firstError && (explicitExitCode === undefined || explicitExitCode === 0);
      settle({
        status: ok ? "ok" : "error",
        logs,
        result: lastResult,
        error: firstError ?? (code === 0 ? undefined : `worker exited with code ${code}`),
        exitCode: explicitExitCode ?? code,
        durationMs: Date.now() - start,
      });
    });
  });
}
