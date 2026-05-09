"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchSnippets, fetchCategories, type Snippet, type CategoryInfo } from "./api";

export interface SnippetsState {
  snippets: Snippet[];
  categories: CategoryInfo[];
  categoryNames: string[];
  isLoading: boolean;
  error: string | null;
  reload: () => void;
}

export function useSnippets(): SnippetsState {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    setIsLoading(true);
    setError(null);

    Promise.all([fetchSnippets(ctrl.signal), fetchCategories(ctrl.signal)])
      .then(([s, c]) => {
        setSnippets(s);
        setCategories(c);
      })
      .catch((err) => {
        if ((err as Error).name === "AbortError") return;
        setError((err as Error).message);
      })
      .finally(() => setIsLoading(false));

    return () => ctrl.abort();
  }, [tick]);

  const categoryNames = useMemo(() => categories.map((c) => c.name), [categories]);

  return {
    snippets,
    categories,
    categoryNames,
    isLoading,
    error,
    reload: () => setTick((t) => t + 1),
  };
}
