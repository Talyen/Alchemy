import { describe, expect, it } from "vitest";
import { cardLibrary } from "@/lib/game-data";
import { getCardKeywords, keywordDefinitions } from "@/lib/game-data/keywords";

describe("keywordDefinitions", () => {
  it("has at least one keyword", () => {
    expect(Object.keys(keywordDefinitions).length).toBeGreaterThan(0);
  });

  it("each keyword has a non-empty id, label, description, colorClass", () => {
    for (const [id, kw] of Object.entries(keywordDefinitions)) {
      expect(kw.id).toBe(id);
      expect(kw.label).toBeTruthy();
      expect(kw.description).toBeTruthy();
      expect(kw.colorClass).toBeTruthy();
    }
  });

  it("every description starts with a capital letter", () => {
    for (const kw of Object.values(keywordDefinitions)) {
      expect(kw.description[0]).toBe(kw.description[0].toUpperCase());
    }
  });

  it("colorClass values start with 'text-'", () => {
    for (const kw of Object.values(keywordDefinitions)) {
      expect(kw.colorClass).toMatch(/^text-/);
    }
  });

  it("all IDs are unique", () => {
    const ids = Object.values(keywordDefinitions).map((k) => k.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("includes archery from card tags", () => {
    const fireArrow = cardLibrary.find((card) => card.id === "fire-arrow");
    expect(fireArrow).toBeDefined();
    expect(getCardKeywords(fireArrow!)).toContain("archery");
    expect(getCardKeywords(fireArrow!)).toContain("burn");
  });

  it("covers expected keywords", () => {
    const expected = [
      "physical",
      "stun",
      "block",
      "forge",
      "armor",
      "health",
      "burn",
      "gold",
      "holy",
      "wish",
      "consume",
      "poison",
      "bleed",
      "leech",
      "freeze",
      "mana",
      "nature",
      "companion",
      "archery",
    ];
    for (const id of expected) {
      expect(keywordDefinitions).toHaveProperty(id);
    }
  });
});
