import { expect, it } from "vitest";
import { cardById, getCardDescription, type BattleCardEffect } from "@/lib/game-data";
import { createCampfirePotionOffers, strengthenPotion } from "@/lib/alchemist/brewing";
import { getTransmutationVariants } from "@/lib/alchemist/transmutation";
import { tryCreateMixedPotion } from "@/lib/alchemist";
import { applyCardEffects } from "@/lib/battle";
import { makeState } from "../../fixtures/battle";
import { createSeededRng } from "@/lib/rng";
import { chance, potion, repeated, roundTrip } from "./fixtures";

it("distills alternate magnitudes together, marks them, and preserves the source", () => {
  const effects: BattleCardEffect[] = [
    { kind: "damage", damageType: "physical", amount: 2, damageTypeIfTargetFrozen: "freeze", amountIfTargetFrozen: 8 },
    { kind: "player-status", status: "block", statusPool: ["block", "forge", "armor"], amount: 5, forgeAmount: 2 },
    { kind: "damage", damageType: "freeze", amount: 2, damageTypeIfTargetFrozen: "freeze", amountIfTargetFrozen: 4 },
  ];
  const source = potion(effects);
  const before = structuredClone(source);
  const result = strengthenPotion(source)!;
  expect(result.effects).toEqual([
    { ...effects[0], amount: 3, amountIfTargetFrozen: 9 },
    { ...effects[1], amount: 6, forgeAmount: 3 },
    { ...effects[2], amount: 3, amountIfTargetFrozen: 6 },
  ]);
  const magnitudes = getCardDescription(result).flatMap((line) =>
    line.parts.filter((part) => typeof part !== "string"),
  );
  expect(magnitudes.length).toBeGreaterThan(0);
  expect(magnitudes.every((part) => part.distilled)).toBe(true);
  expect(roundTrip(result)).toEqual(result);
  expect(source).toEqual(before);
});

it("preserves nested probabilities, durations, conversion rates and derived damage", () => {
  const protectedEffects: BattleCardEffect[] = [
    { kind: "player-status", status: "haste", amount: 1 },
    { kind: "player-status", status: "block", amount: 2, convertCurrentMana: 3 },
    { kind: "player-status", status: "block", amount: 0, perManaCrystal: 2 },
    { kind: "damage", damageType: "holy", amount: 0, equalToBlock: true },
    { kind: "damage", damageType: "holy", amount: 0, equalToArmor: true },
  ];
  expect(strengthenPotion(potion(protectedEffects))).toBeNull();
  const source = potion([repeated([chance([{ kind: "heal", amount: 5 }], protectedEffects, 0.25)])]);
  const result = strengthenPotion(source)!;
  expect(result.effects).toEqual([repeated([chance([{ kind: "heal", amount: 6 }], protectedEffects, 0.25)])]);
  expect(source.effects).toEqual([repeated([chance([{ kind: "heal", amount: 5 }], protectedEffects, 0.25)])]);
});

it("keeps repeated brewing and transmuted Panacea healing through save restoration", () => {
  const first = strengthenPotion(cardById["health-potion"]!)!;
  const again = strengthenPotion(roundTrip(first))!;
  expect(again.effects).toEqual([{ kind: "heal", amount: 10 }]);
  expect(again.cost).toBe(cardById["health-potion"]!.cost);
  const mixed = tryCreateMixedPotion(again, cardById["mana-potion"])!;
  expect(strengthenPotion(mixed)?.effects).toEqual([
    { kind: "heal", amount: 11 },
    { kind: "restore-mana", amount: 3 },
  ]);
  expect(tryCreateMixedPotion(mixed, first)?.effects).toEqual([...mixed.effects, ...first.effects]);
  const converted = getTransmutationVariants(cardById["panacea-potion"]!, "mana", [])[0]!.result;
  const distilled = strengthenPotion(converted)!;
  expect(distilled.effects).toEqual([
    { kind: "remove-harmful-status", removeAll: true },
    { kind: "restore-mana", amount: 3 },
    { kind: "heal", amount: 1 },
  ]);
  expect(strengthenPotion(roundTrip(distilled))?.effects.at(-1)).toEqual({ kind: "heal", amount: 2 });
});

it("distills added Companion actions and applies combat Potion potency", () => {
  const source = getTransmutationVariants(cardById["health-potion"]!, "companion", [cardById["wolf-companion"]!])[0]!
    .result;
  expect(strengthenPotion(source)!.effects.at(-1)).toEqual({ kind: "companion-action", amount: 2 });
  const summoned = applyCardEffects(makeState(), cardById["mana-moth-companion"]!, []);
  const state = { ...summoned, mana: 0, maxMana: 20, talentEffects: { ...summoned.talentEffects, potionPotency: 1.2 } };
  expect(applyCardEffects(state, potion([{ kind: "companion-action", amount: 5 }]), []).mana).toBe(6);
});

it("rejects an unsupported Distill but preserves both valid ingredients when folding would overflow", () => {
  expect(strengthenPotion(potion([{ kind: "heal", amount: 999 }]))).toBeNull();
  const ingredient = potion([{ kind: "heal", amount: 500 }]);
  const mixed = tryCreateMixedPotion(ingredient, ingredient)!;
  expect(mixed.effects).toEqual([...ingredient.effects, ...ingredient.effects]);
  expect(roundTrip(mixed)).toEqual(mixed);
});

it("offers three distinct seeded Potions including recovery or defense", () => {
  const offers = createCampfirePotionOffers(createSeededRng(23));
  expect(new Set(offers.map((card) => card.id)).size).toBe(3);
  expect(offers.some((card) => ["health-potion", "stoneskin-potion", "panacea-potion"].includes(card.id))).toBe(true);
  expect(offers).toEqual(createCampfirePotionOffers(createSeededRng(23)));
});
