"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

  // Loading and error state are reset in reload(), not here: setting state
  // synchronously in an effect body triggers a cascading render.
  useEffect(() => {
    const ctrl = new AbortController();

    Promise.all([fetchSnippets(ctrl.signal), fetchCategories(ctrl.signal)])
      .then(([s, c]) => {
        setSnippets(s);
        setCategories(c);
      })
      .catch((err) => {
        if ((err as Error).name === "AbortError") return;
        setError((err as Error).message);
      })
      .finally(() => {
        // A superseded request must not clear the loading state of its replacement.
        if (!ctrl.signal.aborted) setIsLoading(false);
      });

    return () => ctrl.abort();
  }, [tick]);

  const categoryNames = useMemo(() => categories.map((c) => c.name), [categories]);

  const reload = useCallback(() => {
    setIsLoading(true);
    setError(null);
    setTick((t) => t + 1);
  }, []);

  return {
    snippets,
    categories,
    categoryNames,
    isLoading,
    error,
    reload,
  };
}
