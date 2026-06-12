import { describe, expect, it } from "vitest";
import { buildClassSimDeck } from "@/lib/balance/class-deck";
import { characters, getCardKeywords, getStartingDeck } from "@/lib/game-data";

describe("buildClassSimDeck", () => {
  it("preserves knight starting deck and adds three mid-tier affinity cards", () => {
    const deck = buildClassSimDeck("knight", "mid", 42_000);
    const startingIds = getStartingDeck("knight").map((card) => card.id);
    const knightKeywords = characters.knight.keywords;

    expect(deck.map((card) => card.id).slice(0, startingIds.length)).toEqual(startingIds);
    expect(deck).toHaveLength(startingIds.length + 3);

    const extras = deck.slice(startingIds.length);
    for (const card of extras) {
      const keywords = getCardKeywords(card);
      expect(keywords.some((keyword) => knightKeywords.includes(keyword))).toBe(true);
      expect(startingIds).not.toContain(card.id);
    }
  });

  it("does not duplicate card ids", () => {
    const deck = buildClassSimDeck("knight", "late", 99_001);
    const ids = deck.map((card) => card.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("adds two mixed potions to alchemist decks", () => {
    const deck = buildClassSimDeck("alchemist", "mid", 42_000);
    const mixed = deck.filter((card) => card.id.startsWith("mixed-potion"));
    expect(mixed).toHaveLength(2);
    const first = buildClassSimDeck("alchemist", "mid", 42_000).map((card) => card.id);
    const second = buildClassSimDeck("alchemist", "mid", 42_000).map((card) => card.id);
    expect(second).toEqual(first);
  });

  it("builds wildcard late decks with thirteen offerable cards", () => {
    const deck = buildClassSimDeck("wildcard", "late", 77_777);
    expect(deck).toHaveLength(13);
    expect(deck.every((card) => card.id.length > 0)).toBe(true);
  });

  it("is deterministic for the same seed", () => {
    const first = buildClassSimDeck("wizard", "mid", 12_345).map((card) => card.id);
    const second = buildClassSimDeck("wizard", "mid", 12_345).map((card) => card.id);
    expect(second).toEqual(first);
  });
});
