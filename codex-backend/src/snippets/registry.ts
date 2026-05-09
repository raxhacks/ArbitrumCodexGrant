import { promises as fs, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "../logger.js";
import { SNIPPET_META, type Category } from "./categories.js";

export type Variant = "ethers" | "web3" | "solidity";

export interface Snippet {
  id: string;
  name: string;
  title: string;
  description: string;
  category: Category | "Other";
  language: "javascript" | "solidity";
  variants: Partial<Record<Variant, string>>;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveScriptsDir(): string {
  if (process.env.SCRIPTS_DIR) return path.resolve(process.env.SCRIPTS_DIR);
  const sibling = path.resolve(__dirname, "../../../codex-scripts");
  if (existsSync(sibling)) return sibling;
  return path.resolve(__dirname, "../../snippets-data");
}

const SCRIPTS_DIR = resolveScriptsDir();

const FILENAME_RE = /^(\d{3})_([A-Za-z0-9]+?)(?:_(ethers|web3))?\.(js|sol)$/;

let registry = new Map<string, Snippet>();

interface ParsedFile {
  id: string;
  name: string;
  variant: Variant;
  ext: "js" | "sol";
}

function parseFilename(fname: string): ParsedFile | null {
  const m = fname.match(FILENAME_RE);
  if (!m) return null;
  const [, num, name, suffix, ext] = m;
  if (ext === "sol") {
    return { id: `${num}_${name}`, name, variant: "solidity", ext };
  }
  if (ext === "js" && (suffix === "ethers" || suffix === "web3")) {
    return { id: `${num}_${name}`, name, variant: suffix, ext };
  }
  return null;
}

export async function loadRegistry(): Promise<Map<string, Snippet>> {
  const next = new Map<string, Snippet>();

  let entries: string[];
  try {
    entries = await fs.readdir(SCRIPTS_DIR);
  } catch (err) {
    logger.error({ err, dir: SCRIPTS_DIR }, "failed to read codex-scripts directory");
    throw err;
  }

  for (const fname of entries) {
    const parsed = parseFilename(fname);
    if (!parsed) continue;

    const fullPath = path.join(SCRIPTS_DIR, fname);
    const code = await fs.readFile(fullPath, "utf8");

    const meta = SNIPPET_META[parsed.id];
    const existing = next.get(parsed.id);

    if (existing) {
      existing.variants[parsed.variant] = code;
      continue;
    }

    next.set(parsed.id, {
      id: parsed.id,
      name: parsed.name,
      title: meta?.title ?? parsed.name,
      description: meta?.description ?? "",
      category: meta?.category ?? "Other",
      language: parsed.ext === "sol" ? "solidity" : "javascript",
      variants: { [parsed.variant]: code },
    });
  }

  registry = next;
  logger.info({ count: registry.size }, "snippet registry loaded");
  return registry;
}

export function getRegistry(): Map<string, Snippet> {
  return registry;
}

export function listSnippets(): Snippet[] {
  return Array.from(registry.values()).sort((a, b) => a.id.localeCompare(b.id));
}

export function getSnippet(id: string): Snippet | undefined {
  return registry.get(id);
}
