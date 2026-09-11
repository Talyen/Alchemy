import { describe, expect, it } from "vitest";
import { computeEffectiveCost } from "@/lib/battle/card-cost-rules";
import { applyCardEffects } from "@/lib/battle/effect-handlers";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { createMixedPotion, tryCreateMixedPotion } from "@/lib/alchemist";
import { cardById, isMixedPotionCard, isPotionCard, isStandardPotionCard } from "@/lib/game-data";
import { MIXED_POTION_CARD_ID } from "@/lib/game-constants";
import { makeCombatTexts, makeState } from "../../fixtures/battle";
import { defaultTalentEffects, defaultTrinketManifest } from "../../fixtures/default-battle-state";

describe("Mixed potion classification and combat mechanics", () => {
  const healthPotion = cardById["health-potion"]!;
  const manaPotion = cardById["mana-potion"]!;

  it("classifies standard and mixed potions correctly", () => {
    expect(isPotionCard(healthPotion)).toBe(true);
    expect(isStandardPotionCard(healthPotion)).toBe(true);
    expect(isMixedPotionCard(healthPotion)).toBe(false);

    const mixed = createMixedPotion(healthPotion, manaPotion);
    expect(isMixedPotionCard(mixed)).toBe(true);
    expect(isPotionCard(mixed)).toBe(true);
    expect(isStandardPotionCard(mixed)).toBe(false);
    expect(isMixedPotionCard({ id: MIXED_POTION_CARD_ID })).toBe(true);
  });

  it("prevents re-mixing an already-mixed potion", () => {
    const mixed = createMixedPotion(healthPotion, manaPotion);
    expect(() => createMixedPotion(mixed, healthPotion)).toThrow("Cannot mix with an existing Mixed Potion");
    expect(() => createMixedPotion(healthPotion, mixed)).toThrow("Cannot mix with an existing Mixed Potion");
    expect(tryCreateMixedPotion(mixed, healthPotion)).toBeNull();
  });

  it("applies potionPotency talent bonus to mixed potions during battle", () => {
    const mixed = createMixedPotion(healthPotion, manaPotion);

    const state = makeState({
      playerHealth: 10,
      playerMaxHealth: 30,
      talentEffects: {
        ...defaultTalentEffects,
        potionPotency: 2,
      },
    });

    const texts = makeCombatTexts();
    const nextState = applyCardEffects(state, mixed, texts);

    expect(nextState.playerHealth).toBe(26);
  });

  it("allows Mortar & Pestle free-first-potion discount to apply to mixed potions", () => {
    const mixed = createMixedPotion(healthPotion, manaPotion);
    const state = makeState({
      trinketEffects: defaultTrinketManifest({
        mortarPestleFreeFirstPotion: true,
      }),
    });

    const { effectiveCost, consumedFlags } = computeEffectiveCost(state, mixed);
    expect(effectiveCost).toBe(0);
    expect(consumedFlags.has("firstPotionFreeUsed")).toBe(true);
  });

  it("deals Poison for a standard Potion use", () => {
    const state = makeState({
      hand: [healthPotion],
      playerHealth: 10,
      playerMaxHealth: 30,
      trinketEffects: defaultTrinketManifest({ mortarPestlePoisonOnPotionUse: 1 }),
    });

    const result = playBattleCardResolved(state, healthPotion.id, 0);

    expect(result.state.enemyStatuses.poison).toBe(1);
  });

  it("deals Poison for a mixed Potion use", () => {
    const mixed = createMixedPotion(healthPotion, manaPotion);
    const state = makeState({
      hand: [mixed],
      playerHealth: 10,
      playerMaxHealth: 30,
      trinketEffects: defaultTrinketManifest({ mortarPestlePoisonOnPotionUse: 1 }),
    });

    const result = playBattleCardResolved(state, mixed.id, 0);

    expect(result.state.enemyStatuses.poison).toBe(1);
  });

  it("does not trigger for a non-Potion card", () => {
    const card = {
      ...healthPotion,
      id: "ordinary-heal",
    };
    const state = makeState({
      hand: [card],
      playerHealth: 10,
      playerMaxHealth: 30,
      trinketEffects: defaultTrinketManifest({ mortarPestlePoisonOnPotionUse: 1 }),
    });

    const result = playBattleCardResolved(state, card.id, 0);

    expect(result.state.enemyStatuses.poison).toBe(0);
  });

  it("triggers once for each duplicated Potion use", () => {
    const state = makeState({
      hand: [healthPotion],
      playerHealth: 10,
      playerMaxHealth: 30,
      flags: { ...makeState().flags, playNextCardTwice: true },
      trinketEffects: defaultTrinketManifest({ mortarPestlePoisonOnPotionUse: 1 }),
    });

    const result = playBattleCardResolved(state, healthPotion.id, 0);

    expect(result.state.enemyStatuses.poison).toBe(2);
  });
});
