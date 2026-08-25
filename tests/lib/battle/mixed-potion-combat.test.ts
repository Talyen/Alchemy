import { describe, expect, it } from "vitest";
import { computeEffectiveCost } from "@/lib/battle/card-cost-rules";
import { applyCardEffects } from "@/lib/battle/effect-handlers/dispatch";
import { createMixedPotion, tryCreateMixedPotion } from "@/lib/alchemist/potion-mixer";
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
    // Base health-potion heals 8. Mixed with mana-potion, heal amount is 8.
    const state = makeState({
      playerHealth: 10,
      playerMaxHealth: 30,
      talentEffects: {
        ...defaultTalentEffects,
        potionPotency: 2, // 2x multiplier
      },
    });

    const texts = makeCombatTexts();
    const nextState = applyCardEffects(state, mixed, texts);
    // With 2x potency, heal 8 becomes heal 16 (10 + 16 = 26)
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
});
