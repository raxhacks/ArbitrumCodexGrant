export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export type VariantKey = "ethers" | "web3" | "solidity";

export interface Snippet {
  id: string;
  number: string;
  name: string;
  title: string;
  description: string;
  category: string;
  language: "javascript" | "solidity";
  variants: Partial<Record<VariantKey, string>>;
}

export interface CategoryInfo {
  name: string;
  count: number;
}

export interface RunLog {
  level: string;
  message: string;
  ts: number;
}

export type RunStatus = "ok" | "error" | "timeout" | "memory";

export interface RunResult {
  snippetId: string;
  variant: "ethers" | "web3";
  status: RunStatus;
  logs: RunLog[];
  result?: string | null;
  error?: string;
  exitCode?: number;
  durationMs: number;
}

interface RunErrorBody {
  error: string;
  details?: unknown;
  available?: string[];
}

interface ListResponse {
  count: number;
  items: Array<Omit<Snippet, "number">>;
}

interface CategoriesResponse {
  categories: CategoryInfo[];
}

const toClientSnippet = (raw: Omit<Snippet, "number">): Snippet => ({
  ...raw,
  number: raw.id.split("_")[0] ?? raw.id,
});

export async function fetchSnippets(signal?: AbortSignal): Promise<Snippet[]> {
  const res = await fetch(`${API_BASE_URL}/api/snippets`, { signal });
  if (!res.ok) throw new Error(`Failed to load snippets (HTTP ${res.status})`);
  const body = (await res.json()) as ListResponse;
  return body.items.map(toClientSnippet);
}

export async function fetchCategories(signal?: AbortSignal): Promise<CategoryInfo[]> {
  const res = await fetch(`${API_BASE_URL}/api/categories`, { signal });
  if (!res.ok) throw new Error(`Failed to load categories (HTTP ${res.status})`);
  const body = (await res.json()) as CategoriesResponse;
  return body.categories;
}

export async function runSnippet(
  snippetId: string,
  variant: "ethers" | "web3",
  options?: { timeoutMs?: number; memoryMb?: number; signal?: AbortSignal }
): Promise<RunResult> {
  const res = await fetch(`${API_BASE_URL}/api/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      snippetId,
      variant,
      timeoutMs: options?.timeoutMs,
      memoryMb: options?.memoryMb,
    }),
    signal: options?.signal,
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as RunErrorBody;
    const message =
      body.error === "rate_limited"
        ? "Rate limit reached. Wait a minute and try again."
        : body.error === "variant_not_available"
          ? `Variant ${variant} not available (have: ${(body.available ?? []).join(", ")})`
          : body.error ?? `HTTP ${res.status}`;
    throw new Error(message);
  }

  return (await res.json()) as RunResult;
}
