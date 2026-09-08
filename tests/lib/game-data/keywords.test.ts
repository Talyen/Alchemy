import { describe, expect, it } from "vitest";
import { cardLibrary } from "@/lib/game-data";
import { getCardKeywords, keywordDefinitions } from "@/lib/game-data/keywords";

describe("keywordDefinitions", () => {
  it("each keyword has a non-empty id, label, description, colorClass", () => {
    for (const [id, kw] of Object.entries(keywordDefinitions)) {
      expect(kw.id).toBe(id);
      expect(kw.label).toBeTruthy();
      expect(kw.description).toBeTruthy();
      expect(kw.colorClass).toBeTruthy();
    }
  });

  it("includes archery from card tags", () => {
    const fireArrow = cardLibrary.find((card) => card.id === "fire-arrow");
    expect(fireArrow).toBeDefined();
    expect(getCardKeywords(fireArrow!)).toContain("archery");
    expect(getCardKeywords(fireArrow!)).toContain("burn");
  });
});

it.each([
  ["gamblers-shot", ["physical", "archery"]],
  ["roll-the-dice", ["physical", "gold"]],
  ["astral-arrow", ["freeze", "burn", "holy", "consume", "archery"]],
])("keeps %s eligible for all of its keyword rewards", (id, expected) => {
  const card = cardLibrary.find((entry) => entry.id === id);
  expect(card).toBeDefined();
  expect(getCardKeywords(card!)).toEqual(expect.arrayContaining(expected));
});
