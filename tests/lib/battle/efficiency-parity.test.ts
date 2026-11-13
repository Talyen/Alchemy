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

it("keeps the first duplicate enemy setup modifiers, including zero values", async () => {
  const { initializeEnemyState } = await import("@/lib/battle/battle-enemy-setup");
  const { enemyBestiary } = await import("@/lib/game-data");
  const enemy = enemyBestiary[0]!;
  const base = initializeEnemyState(enemy, 1, []);
  const result = initializeEnemyState(enemy, 1, [
    { kind: "enemy-health-multiplier", amount: 0 },
    { kind: "enemy-health-multiplier", amount: 2 },
    { kind: "enemy-starting-armor", amount: 0 },
    { kind: "enemy-starting-armor", amount: 8 },
    { kind: "start-block", amount: 0 },
    { kind: "start-block", amount: 5 },
    { kind: "start-max-mana", amount: 0 },
    { kind: "start-max-mana", amount: 3 },
    { kind: "start-companion", companionId: "wolf" },
    { kind: "start-companion", companionId: "phoenix" },
  ]);
  expect(result).toMatchObject({
    enemyMaxHealth: 0,
    startingArmor: base.startingArmor,
    startBlock: 0,
    manaBonus: 0,
    startCompanion: true,
    startCompanionId: "wolf",
  });
});

it("preserves Potion offer order and the following seeded draw", async () => {
  const { createCampfirePotionOffers } = await import("@/lib/alchemist/brewing");
  const { getStandardPotionPoolView } = await import("@/lib/game-data");
  const { CAMPFIRE_POTION_OFFERS } = await import("@/lib/game-constants");
  const { createSeededRng, shuffle } = await import("@/lib/rng");
  for (let seed = 1; seed <= 32; seed++) {
    const actualRng = createSeededRng(seed);
    const referenceRng = createSeededRng(seed);
    const actual = createCampfirePotionOffers(actualRng);
    const reference = shuffle(getStandardPotionPoolView(), referenceRng);
    const index = reference.findIndex((card) =>
      ["health-potion", "stoneskin-potion", "panacea-potion"].includes(card.id),
    );
    if (index > 0) reference.unshift(...reference.splice(index, 1));
    expect(actual).toEqual(reference.slice(0, CAMPFIRE_POTION_OFFERS));
    expect(actualRng()).toBe(referenceRng());
  }
});
