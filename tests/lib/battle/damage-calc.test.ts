import { describe, expect, it, vi } from "vitest";
import { computeCardDamageToEnemy } from "@/lib/battle/damage-calc";
import { defaultTalentEffects } from "@/lib/battle";
import { detonateEnemyStatuses } from "@/lib/battle/dot-resolve";
import { CRIT_MULTIPLIER } from "@/lib/game-constants";
import type { BattleCardEffect } from "@/lib/game-data";
import { dealDamage, makeCombatTexts, makeEffect, makeTestCard, patchBattleState } from "../../fixtures/battle";

describe("computeCardDamageToEnemy", () => {
  const physicalEffect: Extract<BattleCardEffect, { kind: "damage" }> = {
    kind: "damage",
    damageType: "physical",
    amount: 6,
  };

  it.each(["rolled", "next-hit", "physical", "guaranteed"] as const)(
    "%s critical hits share the bonus formula and preserve RNG consumption",
    (source) => {
      const rng = vi.fn(() => 0);
      const state = patchBattleState({
        enemyMitigation: { block: 0, armor: 0 },
        talentEffects: { homesteadCriticalDamage: 3 },
        flags: { nextHitCrit: source === "next-hit", nextPhysicalCrit: source === "physical" },
        rng,
      });
      const context = { manaAtStart: 3, enemyFreezeSkipTurnsAtStart: 0, guaranteedCrit: source === "guaranteed" };
      const result = computeCardDamageToEnemy(state, physicalEffect, undefined, context);
      expect(result.modifiedDamage).toBe(physicalEffect.amount * CRIT_MULTIPLIER + 3);
      expect(result.critical).toBe(true);
      expect(result.nextState.flags.nextHitCrit).toBe(false);
      expect(result.nextState.flags.nextPhysicalCrit).toBe(false);
      expect(rng).toHaveBeenCalledTimes(source === "rolled" ? 1 : 0);

      rng.mockClear();
      const zeroDamage = computeCardDamageToEnemy(state, { ...physicalEffect, amount: 0 }, undefined, context);
      expect(zeroDamage.modifiedDamage).toBe(0);
      expect(zeroDamage.critical).toBe(false);
      expect(zeroDamage.nextState.flags.nextHitCrit).toBe(source === "next-hit");
      expect(zeroDamage.nextState.flags.nextPhysicalCrit).toBe(source === "physical");
      expect(rng).toHaveBeenCalledTimes(source === "rolled" ? 1 : 0);
    },
  );

  it("doubles forge contribution for physical with expert blacksmith", () => {
    const state = patchBattleState({
      playerStatuses: { forge: 3 },
      enemyMitigation: { block: 0, armor: 0 },
      talentEffects: { ...defaultTalentEffects, forgeToPhysicalDamageMultiplier: 2 },
      rng: () => 0.99,
    });
    const { modifiedDamage } = computeCardDamageToEnemy(state, physicalEffect);
    expect(modifiedDamage).toBe(physicalEffect.amount + 3 * 2);
  });

  it("adds half block to physical via blockToPhysicalDamageMultiplier", () => {
    const state = patchBattleState({
      playerStatuses: { block: 10 },
      enemyMitigation: { block: 0, armor: 0 },
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
    const state = patchBattleState({
      enemyMitigation: { block: 0, armor: 0 },
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

describe("low-health damage bonuses", () => {
  it.each([14, 15, 16])("requires strictly below half Health at %s/30", (playerHealth) => {
    const base = patchBattleState();
    const state = patchBattleState({
      playerHealth,
      playerMaxHealth: 30,
      rng: () => 0.99,
      talentEffects: { ...base.talentEffects, physicalDoubledBelowHalfHealth: true, bleedDesperateMultiplier: 1.5 },
    });
    expect(computeCardDamageToEnemy(state, { kind: "damage", damageType: "physical", amount: 10 }).modifiedDamage).toBe(
      playerHealth < 15 ? 20 : 10,
    );
    expect(computeCardDamageToEnemy(state, { kind: "damage", damageType: "bleed", amount: 10 }).modifiedDamage).toBe(
      playerHealth < 15 ? 15 : 10,
    );
  });
});

describe("resolved card damage", () => {
  it("resolves Block before Armor, decays Armor, and reports only damage reaching Health without mutating input", () => {
    const state = patchBattleState({ enemyMitigation: { block: 4, armor: 3 }, rng: () => 0.99 });
    const card = makeTestCard({ effects: [makeEffect("physical", 10)] });
    const texts = makeCombatTexts();
    const result = dealDamage(state, card, texts);
    expect(result.enemyHealth).toBe(27);
    expect(result.enemyMitigation).toEqual({ block: 0, armor: 2, forge: 0 });
    expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat: "physical", amount: 3 });
    expect(state.enemyHealth).toBe(30);
    expect(state.enemyMitigation).toEqual({ block: 4, armor: 3, forge: 0 });
  });

  it("combines Gear and Talent damage once before mitigation", () => {
    const state = patchBattleState({
      gearEffects: { flatPhysicalDamage: 3 },
      talentEffects: { flatPhysicalDamage: 2 },
      rng: () => 0.99,
    });
    expect(dealDamage(state, makeTestCard({ effects: [makeEffect("physical", 5)] })).enemyHealth).toBe(20);
  });

  it.each(["block", "armor"] as const)("uses live %s plus Forge and spends Forge only once", (resource) => {
    const state = patchBattleState({ playerStatuses: { [resource]: 7, forge: 3 }, rng: () => 0.99 });
    const effect = makeEffect("physical", 0, resource === "block" ? { equalToBlock: true } : { equalToArmor: true });
    const result = dealDamage(state, makeTestCard({ effects: [effect] }));
    expect(result.enemyHealth).toBe(20);
    expect(result.playerStatuses.forge).toBe(2);
    expect(result.playerStatuses[resource]).toBe(7);
  });

  it("caps lethal hits at zero and leaves Forge untouched for zero damage", () => {
    expect(
      dealDamage(patchBattleState({ enemyHealth: 3 }), makeTestCard({ effects: [makeEffect("physical", 100)] }))
        .enemyHealth,
    ).toBe(0);
    const state = patchBattleState({ rng: () => 0.99 });
    const texts = makeCombatTexts();
    const result = dealDamage(state, makeTestCard({ effects: [makeEffect("physical", 0)] }), texts);
    expect(result.enemyHealth).toBe(30);
    expect(result.playerStatuses.forge).toBe(0);
    expect(texts).toEqual([]);
  });

  it("spends each first-Burn opportunity once and leaves an identity multiplier unspent", () => {
    const card = makeTestCard({ effects: [makeEffect("burn", 5)] });
    const state = patchBattleState({
      rng: () => 0.99,
      talentEffects: { firstBurnCardBonusMultiplier: 1.5 },
      trinketEffects: { firstBurnDoubled: true },
    });
    const first = dealDamage(state, card);
    expect(first.enemyHealth).toBe(17);
    expect(first.flags.firstBurnCardDoubledUsed).toBe(true);
    expect(first.flags.firstBurnTrinketDoubledUsed).toBe(true);
    const second = dealDamage(first, card);
    expect(second.enemyHealth).toBe(12);
    const ordinary = dealDamage(
      patchBattleState({ talentEffects: { firstBurnCardBonusMultiplier: 1 }, rng: () => 0.99 }),
      card,
    );
    expect(ordinary.enemyHealth).toBe(25);
    expect(ordinary.flags.firstBurnCardDoubledUsed).toBe(false);
  });

  it.each(["burn", "poison", "bleed", "freeze", "stun"] as const)(
    "reports exact %s damage and builds only its matching status",
    (damageType) => {
      const state = patchBattleState({ rng: () => 0.99 });
      const texts = makeCombatTexts();
      const result = dealDamage(state, makeTestCard({ effects: [makeEffect(damageType, 5)] }), texts);
      expect(result.enemyHealth).toBe(25);
      expect(result.enemyStatuses).toEqual({ ...state.enemyStatuses, [damageType]: 5 });
      expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat: damageType, amount: 5 });
    },
  );

  it("pays queued Bleed Leech once when its stacks detonate", () => {
    const state = patchBattleState({ playerHealth: 20, rng: () => 0.99 });
    const afterHit = dealDamage(state, makeTestCard({ effects: [makeEffect("bleed", 5, { lifesteal: true })] }));
    expect(afterHit.pendingBleedLeechHealing).toBe(5);
    expect(afterHit.playerHealth).toBe(23);
    const afterDetonate = detonateEnemyStatuses(afterHit, ["bleed"], []);
    expect(afterDetonate.pendingBleedLeechHealing).toBe(0);
    expect(afterDetonate.playerHealth).toBe(26);
    expect(detonateEnemyStatuses(afterDetonate, ["bleed"], []).playerHealth).toBe(26);
  });

  it("distinguishes ignored Armor from destroyed Armor, and lets Burn bypass Armor", () => {
    const state = patchBattleState({ enemyMitigation: { armor: 5 }, rng: () => 0.99 });
    const card = makeTestCard({ tags: ["archery"], effects: [makeEffect("physical", 10)] });
    const pierced = dealDamage({ ...state, talentEffects: { ...state.talentEffects, archeryArmorPiercing: 1 } }, card);
    expect(pierced.enemyHealth).toBe(24);
    expect(pierced.enemyMitigation.armor).toBe(4);
    const sundered = dealDamage(
      { ...state, trinketEffects: { ...state.trinketEffects, sunderingArmorPiercing: 2 } },
      card,
    );
    expect(sundered.enemyHealth).toBe(23);
    expect(sundered.enemyMitigation.armor).toBe(2);
    expect(dealDamage(state, makeTestCard({ effects: [makeEffect("burn", 10)] })).enemyHealth).toBe(20);
  });

  it.each([
    ["physical", "armor"],
    ["nature", "forge"],
  ] as const)("siphons enemy %s-hit %s to the hero without duplicating the benefit", (damageType, stat) => {
    const state = patchBattleState({
      enemyMitigation: { [stat]: 5 },
      talentEffects: { trinketSiphonChance: 100 },
      rng: () => 0.1,
    });
    const result = dealDamage(state, makeTestCard({ effects: [makeEffect(damageType, 10, { lifesteal: true })] }));
    expect(result.enemyMitigation[stat]).toBe(stat === "armor" ? 3 : 4);
    expect(result.playerStatuses[stat]).toBe(1);
  });
});
