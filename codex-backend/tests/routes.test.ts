import { describe, it, expect, beforeAll } from "vitest";
import express from "express";
import request from "supertest";
import { loadRegistry } from "../src/snippets/registry.js";
import { snippetsRouter } from "../src/routes/snippets.js";
import { runRouter } from "../src/routes/run.js";

let app: express.Express;

beforeAll(async () => {
  await loadRegistry();
  app = express();
  app.use(express.json());
  app.use("/api", snippetsRouter);
  app.use("/api", runRouter);
});

describe("GET /api/snippets", () => {
  it("returns 29 items with variant sources inlined", async () => {
    const r = await request(app).get("/api/snippets");
    expect(r.status).toBe(200);
    expect(r.body.count).toBe(29);
    expect(r.body.items[0]).toHaveProperty("id");
    expect(r.body.items[0]).toHaveProperty("title");
    const blockNumberSnippet = r.body.items.find((s: { id: string }) => s.id === "025_GetBlockNumber");
    expect(blockNumberSnippet).toBeDefined();
    expect(blockNumberSnippet.variants.ethers).toMatch(/JsonRpcProvider/);
  });

  it("filters by category", async () => {
    const r = await request(app).get("/api/snippets?category=Timeboost");
    expect(r.status).toBe(200);
    expect(r.body.count).toBe(8);
    expect(r.body.items.every((s: { category: string }) => s.category === "Timeboost")).toBe(true);
  });

  it("filters by search term", async () => {
    const r = await request(app).get("/api/snippets?search=block");
    expect(r.status).toBe(200);
    expect(r.body.count).toBeGreaterThan(0);
  });
});

describe("GET /api/snippets/:id", () => {
  it("returns full snippet with variant source", async () => {
    const r = await request(app).get("/api/snippets/025_GetBlockNumber");
    expect(r.status).toBe(200);
    expect(r.body.id).toBe("025_GetBlockNumber");
    expect(r.body.variants.ethers).toMatch(/JsonRpcProvider/);
  });

  it("returns 404 for unknown id", async () => {
    const r = await request(app).get("/api/snippets/999_Nope");
    expect(r.status).toBe(404);
    expect(r.body.error).toBe("snippet_not_found");
  });
});

describe("GET /api/categories", () => {
  it("returns all 6 categories with counts that sum to 29", async () => {
    const r = await request(app).get("/api/categories");
    expect(r.status).toBe(200);
    expect(r.body.categories).toHaveLength(6);
    const total = r.body.categories.reduce(
      (acc: number, c: { count: number }) => acc + c.count,
      0
    );
    expect(total).toBe(29);
  });
});

describe("POST /api/run", () => {
  it("rejects invalid body", async () => {
    const r = await request(app).post("/api/run").send({ snippetId: "bad" });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe("invalid_body");
  });

  it("rejects unknown snippet id", async () => {
    const r = await request(app)
      .post("/api/run")
      .send({ snippetId: "999_Missing", variant: "ethers" });
    expect(r.status).toBe(404);
  });

  it("rejects unavailable variant", async () => {
    const r = await request(app)
      .post("/api/run")
      .send({ snippetId: "001_ARBPriceOracle", variant: "ethers" });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe("variant_not_available");
  });

  it("runs a snippet end-to-end and returns logs", async () => {
    const r = await request(app)
      .post("/api/run")
      .send({ snippetId: "025_GetBlockNumber", variant: "ethers", timeoutMs: 12000 });
    expect(r.status).toBe(200);
    expect(r.body.status).toBe("ok");
    expect(r.body.logs.length).toBeGreaterThan(0);
    expect(r.body.logs[0].message).toMatch(/Block: \d+/);
  }, 20_000);
});
