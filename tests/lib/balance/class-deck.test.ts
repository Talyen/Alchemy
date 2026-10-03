import { describe, expect, it } from "vitest";
import { buildClassSimDeck, removeCompanionSummonFromDeck } from "@/lib/balance/class-deck";
import { characters, getCardKeywords, getStartingDeck } from "@/lib/game-data";
import { makeTestCard } from "../../fixtures/cards";
import {
  buildSimCompanionBondLevels,
  buildTypicalHomesteadEffects,
  companionIdsFromDeck,
} from "@/lib/balance/homestead-preset";

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
    const first = deck;
    const second = buildClassSimDeck("alchemist", "mid", 42_000);
    expect(second).toEqual(first);
  });
});

describe("companion deck analysis", () => {
  it("finds nested summons in effect order and uses them for bonds and baseline removal", () => {
    const wolf = makeTestCard({
      id: "chance-summon",
      effects: [
        {
          kind: "chance",
          probability: 0.5,
          successEffects: [{ kind: "summon-companion", companionId: "wolf" }],
          failureEffects: [
            {
              kind: "repeat-over-turns",
              remainingTurns: 2,
              effects: [{ kind: "summon-companion", companionId: "phoenix" }],
            },
          ],
        },
      ],
    });
    const repeatedWolf = makeTestCard({
      id: "repeated-wolf",
      effects: [
        { kind: "repeat-over-turns", remainingTurns: 2, effects: [{ kind: "summon-companion", companionId: "wolf" }] },
      ],
    });
    const bear = makeTestCard({ id: "bear", effects: [{ kind: "summon-companion", companionId: "bear" }] });
    const ordinary = makeTestCard({ id: "ordinary", effects: [{ kind: "damage", damageType: "physical", amount: 3 }] });
    const deck = [wolf, repeatedWolf, bear, ordinary];

    expect(companionIdsFromDeck(deck)).toEqual(["wolf", "phoenix", "bear"]);
    expect(buildSimCompanionBondLevels(deck, "late")).toMatchObject({ wolf: 3, phoenix: 3, bear: 3, fox: 0 });
    expect(removeCompanionSummonFromDeck(deck, "wolf")).toEqual([bear, ordinary]);
    expect(removeCompanionSummonFromDeck(deck, "phoenix")).toEqual([repeatedWolf, bear, ordinary]);
    expect(deck).toEqual([wolf, repeatedWolf, bear, ordinary]);
  });
});

describe("simulation homestead presets", () => {
  it("keeps mutable fight effects isolated from later fights and other presets", () => {
    const before = buildTypicalHomesteadEffects("mid");
    const current = buildTypicalHomesteadEffects("mid");
    current.runMaxHealthBonus = 999;
    current.companionBondLevels.wolf = 999;
    current.cardHealBonus.apple = 999;
    expect(buildTypicalHomesteadEffects("mid")).toEqual(before);
    expect(buildTypicalHomesteadEffects("early").runMaxHealthBonus).toBe(0);
    expect(buildTypicalHomesteadEffects("late").runMaxHealthBonus).toBe(10);
  });
});
