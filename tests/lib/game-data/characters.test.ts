import { describe, expect, it } from "vitest";
import { cardLibrary, getCardKeywords } from "@/lib/game-data";
import { characters, getStartingDeck, allStartingDeckCardIds, type CharacterId } from "@/lib/game-data/characters";

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

  it("each hero starts with 7 cards and wildcard drafts (0)", () => {
    // A silently dropped card id would show up here as 6 instead of 7.
    for (const [id, char] of Object.entries(characters)) {
      expect(char.startingDeck.length).toBe(id === "wildcard" ? 0 : 7);
    }
  });

  it("wizard starts with stargaze instead of cold-snap", () => {
    const ids = characters.wizard.startingDeck.map((card) => card.id);
    expect(ids).toContain("stargaze");
    expect(ids).not.toContain("cold-snap");
  });
});

describe("hero badge coverage", () => {
  it("every badge appears in at least one starting-deck card", () => {
    for (const [id, char] of Object.entries(characters)) {
      for (const keyword of char.keywords) {
        const holders = char.startingDeck
          .filter((card) => getCardKeywords(card).includes(keyword))
          .map((card) => card.id);
        expect(holders, `${id} badge "${keyword}" has no starting-deck card`).not.toHaveLength(0);
      }
    }
  });
});

describe("starting deck tooltip lists", () => {
  // Snapshot of exactly what HeroTooltip renders per hero
  // (startingDeck titles joined by ", "). Update deliberately: a diff here
  // means players see a different list on Choose Your Hero + Collection.
  const EXPECTED_TOOLTIP_TITLES: Record<Exclude<CharacterId, "wildcard">, string[]> = {
    knight: ["Anvil", "Bash", "Block", "Plate Mail", "Shield Bash", "Sunder", "Spiked Shield"],
    rogue: ["Steal", "Poison Dagger", "Stab", "Serrated Edge", "Blackjack", "Shadowstep", "Hemorrhage"],
    ranger: ["Wolf", "Pack Tactics", "Lightning Arrow", "Venom Arrow", "Bounty Shot", "Astral Arrow", "Ice Shot"],
    wizard: ["Fireball", "Frostbolt", "Mana Crystals", "Meteor", "Mana Shield", "Stargaze", "Ray of Frost"],
    alchemist: [
      "Acid Potion",
      "Health Potion",
      "Poison Dagger",
      "Wishing Potion",
      "Panacea Potion",
      "Caustic Jab",
      "Kindling",
    ],
    warlock: ["Fangs", "Kindling", "Faustian Bargain", "Blood Offering", "Combustion", "Dark Pact", "Risen Skeleton"],
    druid: ["Bloodthorn", "Grasping Vines", "Mana Berries", "Bear", "Cinderbloom", "Briar Shield", "Earthquake"],
  };

  it("matches the rendered Starting Deck line for every hero", () => {
    for (const [id, titles] of Object.entries(EXPECTED_TOOLTIP_TITLES)) {
      expect(characters[id as CharacterId].startingDeck.map((card) => card.title)).toEqual(titles);
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
