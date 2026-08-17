import { describe, expect, it } from "vitest";
import { computeCardDamageToEnemy, forgeAppliesToDamageType } from "@/lib/battle/damage-calc";
import { defaultTalentEffects } from "@/lib/battle";
import { CRIT_MULTIPLIER } from "@/lib/game-constants";
import type { BattleCardEffect } from "@/lib/game-data";
import { makeTestBattleState, seededRng } from "../../fixtures/battle";

describe("forgeAppliesToDamageType", () => {
  it.each(["physical", "stun"] as const)("always applies to %s", (damageType) => {
    expect(forgeAppliesToDamageType(damageType, defaultTalentEffects)).toBe(true);
  });

  it.each([
    ["burn", "forgeToBurn"],
    ["holy", "forgeToHoly"],
    ["bleed", "forgeToBleed"],
  ] as const)("gates %s on its talent flag", (damageType, talentFlag) => {
    expect(forgeAppliesToDamageType(damageType, defaultTalentEffects)).toBe(false);
    expect(forgeAppliesToDamageType(damageType, { ...defaultTalentEffects, [talentFlag]: true })).toBe(true);
  });
});

describe("computeCardDamageToEnemy", () => {
  const physicalEffect: Extract<BattleCardEffect, { kind: "damage" }> = {
    kind: "damage",
    damageType: "physical",
    amount: 6,
  };

  it("absorbs enemy block before health", () => {
    const state = makeTestBattleState({
      enemyHealth: 30,
      enemyMitigation: { ...makeTestBattleState().enemyMitigation, block: 4 },
      rng: seededRng(99),
    });
    const { nextState, modifiedDamage } = computeCardDamageToEnemy(state, physicalEffect);
    expect(nextState.enemyMitigation.block).toBe(0);
    expect(modifiedDamage).toBe(2);
    expect(nextState.enemyHealth).toBe(30);
  });

  it("applies sundering armor pierce for physical damage", () => {
    const base = makeTestBattleState();
    const state = makeTestBattleState({
      enemyHealth: 30,
      enemyMitigation: { ...base.enemyMitigation, armor: 10, block: 0 },
      trinketEffects: { ...base.trinketEffects, sunderingArmorPiercing: 10 },
    });
    const { modifiedDamage } = computeCardDamageToEnemy(state, physicalEffect);
    expect(modifiedDamage).toBe(6);
  });

  it("applies crit multiplier when random rolls below threshold", () => {
    const state = makeTestBattleState({
      enemyMitigation: { ...makeTestBattleState().enemyMitigation, block: 0, armor: 0 },
      rng: () => 0,
    });
    const { modifiedDamage } = computeCardDamageToEnemy(state, physicalEffect);
    expect(modifiedDamage).toBe(physicalEffect.amount * CRIT_MULTIPLIER);
  });

  it("doubles forge contribution for physical with expert blacksmith", () => {
    const state = makeTestBattleState({
      playerStatuses: { ...makeTestBattleState().playerStatuses, forge: 3 },
      enemyMitigation: { ...makeTestBattleState().enemyMitigation, block: 0, armor: 0 },
      talentEffects: { ...defaultTalentEffects, forgeToPhysicalDamageMultiplier: 2 },
      rng: () => 0.99,
    });
    const { modifiedDamage } = computeCardDamageToEnemy(state, physicalEffect);
    expect(modifiedDamage).toBe(physicalEffect.amount + 3 * 2);
  });

  it("adds half block to physical via blockToPhysicalDamageMultiplier", () => {
    const state = makeTestBattleState({
      playerStatuses: { ...makeTestBattleState().playerStatuses, block: 10 },
      enemyMitigation: { ...makeTestBattleState().enemyMitigation, block: 0, armor: 0 },
      talentEffects: { ...defaultTalentEffects, blockToPhysicalDamageMultiplier: 0.5 },
      rng: () => 0.99,
    });
    const { modifiedDamage } = computeCardDamageToEnemy(state, physicalEffect);
    expect(modifiedDamage).toBe(physicalEffect.amount + 5);
  });

  it("applies consumeDamageBonusPercent to non-burn consume damage", () => {
    const holyEffect: Extract<BattleCardEffect, { kind: "damage" }> = {
      kind: "damage",
      damageType: "holy",
      amount: 10,
    };
    const state = makeTestBattleState({
      enemyMitigation: { ...makeTestBattleState().enemyMitigation, block: 0, armor: 0 },
      talentEffects: { ...defaultTalentEffects, consumeDamageBonusPercent: 20 },
      rng: () => 0.99,
    });
    const { modifiedDamage } = computeCardDamageToEnemy(state, holyEffect, {
      id: "avatar",
      title: "Avatar",
      descriptionLines: [],
      art: "",
      cost: 1,
      consume: true,
      effects: [holyEffect],
    });
    expect(modifiedDamage).toBe(12);
  });
});
