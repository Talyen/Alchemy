import { describe, expect, it } from "vitest";
import { characters, getStartingDeck, allStartingDeckCardIds } from "@/lib/game-data/characters";
import type { CharacterId } from "@/lib/game-data/characters";

describe("characters data integrity", () => {
  it("has all expected characters", () => {
    const expectedIds: CharacterId[] = [
      "knight",
      "ranger",
      "rogue",
      "wizard",
      "alchemist",
      "warlock",
      "druid",
      "wildcard",
    ];
    for (const id of expectedIds) {
      expect(characters[id]).toBeDefined();
    }
  });

  it("each character has a non-empty name and role", () => {
    for (const char of Object.values(characters)) {
      expect(char.name).toBeTruthy();
      expect(char.role).toBeTruthy();
      expect(char.description).toBeTruthy();
    }
  });

  it("each character has at least 5 cards in starting deck (except wildcard)", () => {
    for (const char of Object.values(characters)) {
      if (char.id === "wildcard") {
        expect(char.startingDeck.length).toBe(0);
      } else {
        expect(char.startingDeck.length).toBeGreaterThanOrEqual(5);
      }
    }
  });

  it("each character has at least 1 keyword (except wildcard)", () => {
    for (const char of Object.values(characters)) {
      if (char.id === "wildcard") {
        expect(char.keywords.length).toBe(0);
      } else {
        expect(char.keywords.length).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("each starting deck card has required fields", () => {
    for (const char of Object.values(characters)) {
      for (const card of char.startingDeck) {
        expect(card.id).toBeTruthy();
        expect(typeof card.title).toBe("string");
        expect(Array.isArray(card.effects)).toBe(true);
      }
    }
  });
});

describe("getStartingDeck", () => {
  it("returns a clone that can be mutated without affecting the source", () => {
    const deck = getStartingDeck("knight");
    deck.pop();
    expect(characters.knight.startingDeck.length).toBeGreaterThan(deck.length);
  });

  it("returns the correct number of cards for Knight", () => {
    const deck = getStartingDeck("knight");
    expect(deck.length).toBe(characters.knight.startingDeck.length);
  });
});

describe("allStartingDeckCardIds", () => {
  it("contains unique card IDs", () => {
    expect(new Set(allStartingDeckCardIds).size).toBe(allStartingDeckCardIds.length);
  });

  it("includes cards from all character starting decks", () => {
    for (const char of Object.values(characters)) {
      for (const card of char.startingDeck) {
        expect(allStartingDeckCardIds).toContain(card.id);
      }
    }
  });
});
