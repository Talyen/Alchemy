import { describe, expect, it, vi } from "vitest";
import { computeCardDamageToEnemy, forgeAppliesToDamageType } from "@/lib/battle/damage-calc";
import { defaultTalentEffects } from "@/lib/battle/draw";
import { CRIT_MULTIPLIER } from "@/lib/game-constants";
import type { BattleCardEffect } from "@/lib/game-data";
import { createTestBattleState } from "./test-state";

describe("forgeAppliesToDamageType", () => {
  it("always applies to physical and stun", () => {
    expect(forgeAppliesToDamageType("physical", defaultTalentEffects)).toBe(true);
    expect(forgeAppliesToDamageType("stun", defaultTalentEffects)).toBe(true);
  });

  it("gates burn, holy, and bleed on talent flags", () => {
    expect(forgeAppliesToDamageType("burn", defaultTalentEffects)).toBe(false);
    expect(forgeAppliesToDamageType("burn", { ...defaultTalentEffects, forgeToBurn: true })).toBe(true);
    expect(forgeAppliesToDamageType("holy", { ...defaultTalentEffects, forgeToHoly: true })).toBe(true);
    expect(forgeAppliesToDamageType("bleed", { ...defaultTalentEffects, forgeToBleed: true })).toBe(true);
  });
});

describe("computeCardDamageToEnemy", () => {
  const physicalEffect: Extract<BattleCardEffect, { kind: "damage" }> = {
    kind: "damage",
    damageType: "physical",
    amount: 6,
  };

  it("absorbs enemy block before health", () => {
    const state = createTestBattleState({
      enemyHealth: 30,
      enemyMitigation: { ...createTestBattleState().enemyMitigation, block: 4 },
    });
    const { nextState, modifiedDamage } = computeCardDamageToEnemy(state, physicalEffect);
    expect(nextState.enemyMitigation.block).toBe(0);
    expect(modifiedDamage).toBe(2);
    expect(nextState.enemyHealth).toBe(30);
  });

  it("applies sundering armor pierce for physical damage", () => {
    const base = createTestBattleState();
    const state = createTestBattleState({
      enemyHealth: 30,
      enemyMitigation: { ...base.enemyMitigation, armor: 10, block: 0 },
      trinketEffects: { ...base.trinketEffects, sunderingArmorPiercing: 10 },
    });
    const { modifiedDamage } = computeCardDamageToEnemy(state, physicalEffect);
    expect(modifiedDamage).toBe(6);
  });

  it("applies crit multiplier when random rolls below threshold", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const state = createTestBattleState({
      enemyMitigation: { ...createTestBattleState().enemyMitigation, block: 0, armor: 0 },
      talentEffects: { ...defaultTalentEffects, physicalCritChance: 100 },
    });
    const { modifiedDamage } = computeCardDamageToEnemy(state, physicalEffect);
    expect(modifiedDamage).toBe(physicalEffect.amount * CRIT_MULTIPLIER);
    vi.restoreAllMocks();
  });

  it("applies bleed execute threshold multiplier", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const bleedEffect: Extract<BattleCardEffect, { kind: "damage" }> = {
      kind: "damage",
      damageType: "bleed",
      amount: 5,
    };
    const state = createTestBattleState({
      enemyHealth: 5,
      enemyMaxHealth: 30,
      enemyMitigation: { ...createTestBattleState().enemyMitigation, block: 0, armor: 0 },
      talentEffects: { ...defaultTalentEffects, bleedExecuteThreshold: 25 },
    });
    const { modifiedDamage } = computeCardDamageToEnemy(state, bleedEffect);
    expect(modifiedDamage).toBeGreaterThanOrEqual(10);
    vi.restoreAllMocks();
  });
});
