import { expect, it } from "vitest";
import { nominalCardValue } from "@/lib/battle/autoplay-draft-policy";
import { getCardKeywords, getCardKeywordView } from "@/lib/game-data/keywords";
import type { BattleCardEffect } from "@/lib/game-data";
import { makeTestCard } from "../../fixtures/cards";

it("reuses frozen keyword data without sharing writable results or caching mutable cards", () => {
  const card = makeTestCard({ effects: [{ kind: "heal", amount: 3 }], consume: true, tags: ["archery"] });
  Object.freeze(card.effects[0]);
  Object.freeze(card.effects);
  Object.freeze(card.tags);
  Object.freeze(card.descriptionLines);
  Object.freeze(card);
  const first = getCardKeywordView(card);
  expect(getCardKeywordView(card)).toBe(first);
  expect(first).toEqual(["health", "consume", "archery"]);
  getCardKeywords(card).push("burn");
  expect(getCardKeywords(card)).toEqual(first);

  const editable = makeTestCard({ effects: [{ kind: "heal", amount: 1 }], tags: ["archery"] });
  expect(getCardKeywordView(editable)).toEqual(["health", "archery"]);
  editable.tags = ["burn"];
  expect(getCardKeywordView(editable)).toEqual(["health", "burn"]);
});

it("keeps draft scores detached and follows mutable effects", () => {
  const effects: BattleCardEffect[] = [
    { kind: "damage", damageType: "physical", amount: 4 },
    { kind: "player-status", status: "block", amount: 3 },
  ];
  const first = nominalCardValue(effects);
  expect(first).toEqual({ damage: 4, defense: 3 });
  effects[0] = { kind: "damage", damageType: "physical", amount: 7 };
  expect(nominalCardValue(effects)).toEqual({ damage: 7, defense: 3 });
  for (const effect of effects) Object.freeze(effect);
  Object.freeze(effects);
  const frozenResult = nominalCardValue(effects);
  frozenResult.damage = -1;
  expect(nominalCardValue(effects)).toEqual({ damage: 7, defense: 3 });
});
