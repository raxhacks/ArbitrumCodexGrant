import { Router } from "express";
import { z } from "zod";
import { listSnippets, getSnippet } from "../snippets/registry.js";
import { CATEGORIES } from "../snippets/categories.js";

export const snippetsRouter = Router();

const ListQuery = z.object({
  category: z.string().optional(),
  search: z.string().optional(),
});

snippetsRouter.get("/snippets", (req, res) => {
  const parsed = ListQuery.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_query", details: parsed.error.flatten() });
  }
  const { category, search } = parsed.data;

  let items = listSnippets();

  if (category) {
    items = items.filter((s) => s.category === category);
  }

  if (search) {
    const q = search.toLowerCase();
    items = items.filter(
      (s) =>
        s.id.toLowerCase().includes(q) ||
        s.title.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q)
    );
  }

  res.json({
    count: items.length,
    items: items.map((s) => ({
      id: s.id,
      name: s.name,
      title: s.title,
      description: s.description,
      category: s.category,
      language: s.language,
      variants: s.variants,
    })),
  });
});

snippetsRouter.get("/snippets/:id", (req, res) => {
  const snippet = getSnippet(req.params.id);
  if (!snippet) {
    return res.status(404).json({ error: "snippet_not_found", id: req.params.id });
  }
  res.json(snippet);
});

snippetsRouter.get("/categories", (_req, res) => {
  const counts = listSnippets().reduce<Record<string, number>>((acc, s) => {
    acc[s.category] = (acc[s.category] ?? 0) + 1;
    return acc;
  }, {});

  res.json({
    categories: CATEGORIES.map((name) => ({ name, count: counts[name] ?? 0 })),
  });
});
