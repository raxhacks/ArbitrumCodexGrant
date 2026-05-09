import "dotenv/config";
import { z } from "zod";

const Schema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  ARBITRUM_ONE_RPC_URL: z.string().url().default("https://arb1.arbitrum.io/rpc"),
  ARBITRUM_SEPOLIA_RPC_URL: z.string().url().default("https://sepolia-rollup.arbitrum.io/rpc"),
  SANDBOX_TIMEOUT_MS: z.coerce.number().int().positive().default(90000),
  SANDBOX_MEMORY_MB: z.coerce.number().int().positive().default(128),
  RUN_RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(20),
});

const parsed = Schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;

export const RPC_WHITELIST = new Set<string>([
  config.ARBITRUM_ONE_RPC_URL,
  config.ARBITRUM_SEPOLIA_RPC_URL,
]);
