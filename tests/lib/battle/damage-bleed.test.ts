import { describe, expect, it } from "vitest";
import { patchBattleState } from "../../fixtures/battle";
import { defaultTalentEffects } from "../../fixtures/default-battle-state";
import { dealDamage, makeEffect, makeTestCard } from "../../fixtures/battle";

describe("computeBaseDamage — bleed damage", () => {
  it("applies bleed desperate multiplier when player below half health", () => {
    const state = patchBattleState({
      playerHealth: 10,
      playerMaxHealth: 30,
      talentEffects: { ...defaultTalentEffects, bleedDesperateMultiplier: 1.5 },
    });
    const card = makeTestCard({ effects: [makeEffect("bleed", 5)] });
    const result = dealDamage(state, card);
    expect(result.enemyHealth).toBeLessThan(30);
  });

  it("applies bleed execute threshold multiplier", () => {
    const state = patchBattleState({
      enemyHealth: 5,
      enemyMaxHealth: 30,
      talentEffects: { ...defaultTalentEffects, bleedExecuteThreshold: 25, bleedExecuteMultiplier: 2 },
    });
    const card = makeTestCard({ effects: [makeEffect("bleed", 5)] });
    const result = dealDamage(state, card);
    expect(result.enemyHealth).toBe(0);
  });

  it("does not apply bleed execute when bleedExecuteThreshold is 0", () => {
    const state = patchBattleState({
      enemyHealth: 0,
      enemyMaxHealth: 30,
      talentEffects: { ...defaultTalentEffects, bleedExecuteThreshold: 0 },
    });
    const card = makeTestCard({ effects: [makeEffect("bleed", 5)] });
    const result = dealDamage(state, card);
    expect(result.enemyHealth).toBe(0);
  });
});
