import { describe, expect, it } from "vitest";
import { patchBattleState } from "../../fixtures/battle";
import { defaultTalentEffects } from "../../fixtures/default-battle-state";
import { dealDamage, makeCombatTexts, makeEffect, makeTestCard } from "../../fixtures/battle";
import { applyLifestealAndPlayerHitTriggers } from "@/lib/battle/damage-rider-leech";

describe("dealDamageToEnemy — lifesteal", () => {
  it("heals player when effect has lifesteal", () => {
    const state = patchBattleState({
      rng: () => 0.99,
      playerHealth: 20,
      gold: 50,
      talentEffects: { ...defaultTalentEffects, healMultiplier: 0.5 },
    });
    const card = makeTestCard({ effects: [makeEffect("physical", 10, { lifesteal: true })] });
    const result = dealDamage(state, card);
    expect(result.playerHealth).toBe(23);
  });
});

describe("applyLifestealAndPlayerHitTriggers — leechMissingHealthStep", () => {
  it("adds rounded missing-health chunks on top of base leech (half rounds up)", () => {
    const state = patchBattleState({
      rng: () => 0.99,
      playerHealth: 20,
      talentEffects: { ...defaultTalentEffects, leechMissingHealthStep: 4 },
    });
    const texts = makeCombatTexts();
    const result = applyLifestealAndPlayerHitTriggers(state, 6, texts);
    expect(result.playerHealth).toBe(26);
  });

  it("floors partial chunks below the step size", () => {
    const state = patchBattleState({
      rng: () => 0.99,
      playerHealth: 20,
      talentEffects: { ...defaultTalentEffects, leechMissingHealthStep: 7 },
    });
    const texts = makeCombatTexts();
    const result = applyLifestealAndPlayerHitTriggers(state, 6, texts);
    expect(result.playerHealth).toBe(24);
  });
});
