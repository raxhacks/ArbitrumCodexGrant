import { describe, it, expect, beforeAll } from "vitest";
import { loadRegistry, listSnippets, getSnippet } from "../src/snippets/registry.js";

beforeAll(async () => {
  await loadRegistry();
});

describe("snippet registry", () => {
  it("loads exactly 29 snippets", () => {
    expect(listSnippets()).toHaveLength(29);
  });

  it("ids are 3-digit prefix + PascalCase name", () => {
    for (const s of listSnippets()) {
      expect(s.id).toMatch(/^\d{3}_[A-Za-z0-9]+$/);
    }
  });

  it("every javascript snippet has both ethers and web3 variants", () => {
    const js = listSnippets().filter((s) => s.language === "javascript");
    for (const s of js) {
      expect(Object.keys(s.variants).sort()).toEqual(["ethers", "web3"]);
    }
  });

  it("solidity snippet has only solidity variant", () => {
    const sol = getSnippet("001_ARBPriceOracle");
    expect(sol).toBeDefined();
    expect(sol!.language).toBe("solidity");
    expect(Object.keys(sol!.variants)).toEqual(["solidity"]);
  });

  it("every snippet has a known category (no Other)", () => {
    for (const s of listSnippets()) {
      expect(s.category).not.toBe("Other");
    }
  });

  it("getSnippet returns undefined for unknown id", () => {
    expect(getSnippet("999_DoesNotExist")).toBeUndefined();
  });
});
