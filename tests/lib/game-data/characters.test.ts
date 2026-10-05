import { describe, expect, it } from "vitest";
import { cardLibrary, getCardKeywords } from "@/lib/game-data";
import { characters, getStartingDeck } from "@/lib/game-data/characters";

describe("starting decks", () => {
  it("gives each hero a complete playable deck covering its advertised keywords", () => {
    const cardIds = new Set(cardLibrary.map((card) => card.id));
    for (const [id, hero] of Object.entries(characters)) {
      const deck = getStartingDeck(hero.id);
      expect(deck, id).toHaveLength(id === "wildcard" ? 0 : 7);
      expect(
        deck.every((card) => cardIds.has(card.id)),
        id,
      ).toBe(true);
      const deckKeywords = new Set(deck.flatMap(getCardKeywords));
      expect(
        hero.keywords.filter((keyword) => !deckKeywords.has(keyword)),
        id,
      ).toEqual([]);
    }
    const rogueIds = getStartingDeck("rogue").map((card) => card.id);
    expect(rogueIds).toEqual(["steal", "poison-dagger", "stab", "feint", "blackjack", "shadowstep", "hemorrhage"]);
  });

  it("isolates changes in one run from the catalog and a later run", () => {
    const before = structuredClone(characters.knight.startingDeck);
    const deck = getStartingDeck("knight");
    deck[0]!.title = "Changed title";
    deck[0]!.descriptionLines.push("Changed prose");
    deck[0]!.effects.push({ kind: "heal", amount: 99 });
    const effect = deck[0]!.effects[0]!;
    if (!("amount" in effect)) throw new Error("Expected a starting effect with an amount");
    effect.amount = 99;
    deck.pop();
    expect(characters.knight.startingDeck).toEqual(before);
    expect(getStartingDeck("knight")).toEqual(before);
  });
});
