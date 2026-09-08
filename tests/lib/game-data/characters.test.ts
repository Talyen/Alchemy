import { describe, expect, it } from "vitest";
import { cardLibrary } from "@/lib/game-data";
import { characters, getStartingDeck, allStartingDeckCardIds } from "@/lib/game-data/characters";

describe("characters data integrity", () => {
  it("each character has a valid starting deck referencing cardLibrary IDs", () => {
    const cardIds = new Set(cardLibrary.map((c) => c.id));
    for (const [id, char] of Object.entries(characters)) {
      expect(char.id).toBe(id);
      for (const card of char.startingDeck) {
        expect(cardIds.has(card.id)).toBe(true);
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
});

describe("allStartingDeckCardIds", () => {
  it("indexes every starting card exactly once", () => {
    const expected = new Set(Object.values(characters).flatMap((char) => char.startingDeck.map((card) => card.id)));
    expect([...allStartingDeckCardIds].sort()).toEqual([...expected].sort());
  });
});
