import { describe, expect, it } from "vitest";
import { cardLibrary, companionLibrary, type KeywordId } from "@/lib/game-data";
import { filterKeywordsForTalentXP, getCardKeywords, getCompanionKeywords } from "@/lib/game-data/keywords";
import { makeTestCard } from "../../fixtures/cards";

describe("keywordDefinitions", () => {
  it("keeps only catalog keywords eligible for Talent XP", () => {
    const keywords = ["burn", "constructor", "__proto__", "toString", "health"] as KeywordId[];
    expect(filterKeywordsForTalentXP(keywords)).toEqual(["burn", "health"]);
  });

  it("includes archery from card tags", () => {
    const fireArrow = cardLibrary.find((card) => card.id === "fire-arrow");
    expect(fireArrow).toBeDefined();
    expect(getCardKeywords(fireArrow!)).toContain("archery");
    expect(getCardKeywords(fireArrow!)).toContain("burn");
  });
});

it("keeps card-specific keywords separate and refreshes them when effects are replaced", () => {
  const card = makeTestCard({ effects: [{ kind: "heal", amount: 3 }] });
  const variant = makeTestCard({ ...card, consume: true, tags: ["archery"] });
  expect(getCardKeywords(card)).toEqual(["health"]);
  expect(getCardKeywords(variant)).toEqual(["health", "consume", "archery"]);
  expect(getCardKeywords(card)).toEqual(["health"]);
  card.effects = [{ kind: "damage", damageType: "burn", amount: 3 }];
  expect(getCardKeywords(card)).toEqual(["burn"]);
  expect(getCardKeywords(variant)).toEqual(["health", "consume", "archery"]);
});

it("keeps returned keywords independent of shared card and Companion caches", () => {
  const effects = [{ kind: "heal", amount: 3 }] as const;
  const card = makeTestCard({ effects: [...effects] });
  const variant = { ...card, cost: 0 };
  const companion = { ...Object.values(companionLibrary)[0]!, turnStartEffects: card.effects };

  getCardKeywords(card).splice(0, 1, "burn");
  expect(getCardKeywords(variant)).toEqual(["health"]);
  getCompanionKeywords(companion).push("gold");
  expect(getCompanionKeywords(companion)).toEqual(["health"]);
  expect(getCardKeywords(card)).toEqual(["health"]);
});

it.each([
  ["gamblers-shot", ["stun", "physical", "bleed", "archery"]],
  ["roll-the-dice", ["consume"]],
  ["astral-arrow", ["freeze", "burn", "holy", "consume", "archery"]],
])("keeps %s eligible for all of its keyword rewards", (id, expected) => {
  const card = cardLibrary.find((entry) => entry.id === id);
  expect(card).toBeDefined();
  expect(getCardKeywords(card!)).toEqual(expect.arrayContaining(expected));
});
