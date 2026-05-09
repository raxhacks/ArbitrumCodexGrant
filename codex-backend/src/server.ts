import express from "express";
import cors from "cors";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { loadRegistry } from "./snippets/registry.js";
import { snippetsRouter } from "./routes/snippets.js";
import { runRouter } from "./routes/run.js";

const app = express();

app.use(helmet());

const corsOrigins = config.CORS_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean);
app.use(cors({ origin: corsOrigins.length > 1 ? corsOrigins : corsOrigins[0] }));
app.use(express.json({ limit: "256kb" }));
app.use(pinoHttp({ logger }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

app.use("/api", snippetsRouter);
app.use("/api", runRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "not_found" });
});

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, "unhandled error");
  res.status(500).json({ error: "internal_error" });
});

try {
  await loadRegistry();
} catch (err) {
  logger.fatal({ err }, "boot failed");
  process.exit(1);
}

const server = app.listen(config.PORT, () => {
  logger.info({ port: config.PORT }, "codex-backend listening");
});

const shutdown = (signal: string) => {
  logger.info({ signal }, "shutting down");
  server.close(() => process.exit(0));
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

export { app };
