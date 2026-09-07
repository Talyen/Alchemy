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

describe("low-health Leech bonuses", () => {
  it.each([14, 15, 16])("requires strictly below half Health at %s/30", (health) => {
    const desperate = patchBattleState({
      playerHealth: health,
      playerMaxHealth: 30,
      talentEffects: { leechDesperateMultiplier: 20 },
    });
    expect(applyLifestealAndPlayerHitTriggers(desperate, 10, []).playerHealth - health).toBe(health < 15 ? 6 : 5);
    const execute = patchBattleState({
      playerHealth: 1,
      playerMaxHealth: 30,
      enemyHealth: health,
      enemyMaxHealth: 30,
      talentEffects: { leechExecuteMultiplier: 20 },
    });
    expect(applyLifestealAndPlayerHitTriggers(execute, 10, []).playerHealth).toBe(health < 15 ? 7 : 6);
  });
});
