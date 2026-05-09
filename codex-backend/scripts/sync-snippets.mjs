import { existsSync, mkdirSync, copyFileSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(__dirname, "../../codex-scripts");
const DST = path.resolve(__dirname, "../snippets-data");

if (!existsSync(SRC)) {
  if (existsSync(DST) && readdirSync(DST).length > 0) {
    process.exit(0);
  }
  console.error(`sync-snippets: source not found at ${SRC}`);
  process.exit(1);
}

rmSync(DST, { recursive: true, force: true });
mkdirSync(DST, { recursive: true });

let count = 0;
for (const f of readdirSync(SRC)) {
  if (f.endsWith(".js") || f.endsWith(".sol")) {
    copyFileSync(path.join(SRC, f), path.join(DST, f));
    count++;
  }
}

console.log(`synced ${count} files`);
