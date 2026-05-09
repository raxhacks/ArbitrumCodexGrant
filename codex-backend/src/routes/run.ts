import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { getSnippet, type Variant } from "../snippets/registry.js";
import { runSnippet } from "../sandbox/executor.js";
import { config } from "../config.js";
import { logger } from "../logger.js";

export const runRouter = Router();

const runLimiter = rateLimit({
  windowMs: 60_000,
  max: config.RUN_RATE_LIMIT_PER_MIN,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "rate_limited" },
});

const RunBody = z.object({
  snippetId: z.string().regex(/^\d{3}_[A-Za-z0-9]+$/),
  variant: z.enum(["ethers", "web3"]),
  env: z.record(z.string()).optional(),
  timeoutMs: z.number().int().min(500).max(90_000).optional(),
  memoryMb: z.number().int().min(32).max(512).optional(),
});

runRouter.post("/run", runLimiter, async (req, res) => {
  const parsed = RunBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_body", details: parsed.error.flatten() });
  }
  const { snippetId, variant, env, timeoutMs, memoryMb } = parsed.data;

  const snippet = getSnippet(snippetId);
  if (!snippet) {
    return res.status(404).json({ error: "snippet_not_found", id: snippetId });
  }

  const code = snippet.variants[variant as Variant];
  if (!code) {
    return res.status(400).json({
      error: "variant_not_available",
      requested: variant,
      available: Object.keys(snippet.variants),
    });
  }

  if (snippet.language === "solidity") {
    return res.status(400).json({ error: "solidity_execution_not_supported", id: snippetId });
  }

  logger.info({ snippetId, variant, timeoutMs, memoryMb }, "run requested");

  try {
    const result = await runSnippet({ code, env, timeoutMs, memoryMb });
    res.json({
      snippetId,
      variant,
      ...result,
    });
  } catch (err) {
    logger.error({ err, snippetId }, "run failed unexpectedly");
    res.status(500).json({ error: "run_failed" });
  }
});
