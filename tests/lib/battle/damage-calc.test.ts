import { describe, expect, it } from "vitest";
import { computeCardDamageToEnemy, forgeAppliesToDamageType } from "@/lib/battle/damage-calc";
import { defaultTalentEffects } from "@/lib/battle";
import { defaultGearEffects } from "@/lib/gear";
import { detonateEnemyStatuses } from "@/lib/battle/dot-resolve";
import { CRIT_MULTIPLIER } from "@/lib/game-constants";
import type { BattleCardEffect, DamageType } from "@/lib/game-data";
import {
  dealDamage,
  makeCombatTexts,
  makeEffect,
  makeTestCard,
  patchBattleState,
  seededRng,
} from "../../fixtures/battle";
import { defaultPlayerStatusValues } from "../../fixtures/default-battle-state";
import { defaultCombatFlags, defaultTrinketManifest } from "../../fixtures/default-battle-state";

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
    const state = patchBattleState({
      enemyHealth: 30,
      enemyMitigation: { block: 4 },
      rng: seededRng(99),
    });
    const { nextState, modifiedDamage } = computeCardDamageToEnemy(state, physicalEffect);
    expect(nextState.enemyMitigation.block).toBe(0);
    expect(modifiedDamage).toBe(2);
    expect(nextState.enemyHealth).toBe(30);
  });

  it("applies sundering armor pierce for physical damage", () => {
    const base = patchBattleState();
    const state = patchBattleState({
      enemyHealth: 30,
      enemyMitigation: { ...base.enemyMitigation, armor: 10, block: 0 },
      trinketEffects: { ...base.trinketEffects, sunderingArmorPiercing: 10 },
    });
    const { modifiedDamage } = computeCardDamageToEnemy(state, physicalEffect);
    expect(modifiedDamage).toBe(6);
  });

  it("applies crit multiplier when random rolls below threshold", () => {
    const state = patchBattleState({
      enemyMitigation: { block: 0, armor: 0 },
      rng: () => 0,
    });
    const { modifiedDamage } = computeCardDamageToEnemy(state, physicalEffect);
    expect(modifiedDamage).toBe(physicalEffect.amount * CRIT_MULTIPLIER);
  });

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

describe("dealDamageToEnemy — basic physical damage", () => {
  it("deals base damage to enemy health", () => {
    const state = patchBattleState({ enemyHealth: 30 });
    const card = makeTestCard({ effects: [makeEffect("physical", 5)] });
    const result = dealDamage(state, card);
    expect(result.enemyHealth).toBe(25);
  });

  it("adds gear flat physical damage separately from talents", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      gearEffects: { ...defaultGearEffects, flatPhysicalDamage: 3 },
      talentEffects: { ...patchBattleState().talentEffects, flatPhysicalDamage: 0 },
    });
    const card = makeTestCard({ effects: [makeEffect("physical", 5)] });
    const result = dealDamage(state, card);
    expect(result.enemyHealth).toBe(22);
  });

  it("adds gear flat bonuses for each damage type", () => {
    const damageTypes = [
      ["physical", "flatPhysicalDamage"],
      ["stun", "flatStunDamage"],
      ["holy", "flatHolyDamage"],
      ["burn", "flatBurnDamage"],
      ["poison", "flatPoisonDamage"],
      ["bleed", "flatBleedDamage"],
      ["freeze", "flatFreezeDamage"],
      ["nature", "flatNatureDamage"],
    ] as const;

    for (const [damageType, gearKey] of damageTypes) {
      const state = patchBattleState({
        enemyHealth: 30,
        gearEffects: { ...defaultGearEffects, [gearKey]: 1 },
        talentEffects: { ...patchBattleState().talentEffects },
      });
      const card = makeTestCard({ effects: [makeEffect(damageType, 5)] });
      const result = dealDamage(state, card);
      expect(result.enemyHealth).toBe(24);
    }
  });

  it("produces combat text for damage", () => {
    const state = patchBattleState({ enemyHealth: 30 });
    const card = makeTestCard({ effects: [makeEffect("physical", 5)] });
    const texts = makeCombatTexts();
    dealDamage(state, card, texts);
    expect(texts.length).toBeGreaterThan(0);
    expect(texts.some((t) => t.target === "enemy" && t.kind === "damage")).toBe(true);
  });
});

describe("computeBaseDamage — equalToBlock / equalToArmor", () => {
  it("damage equals block plus forge when equalToBlock", () => {
    const state = patchBattleState({ playerStatuses: defaultPlayerStatusValues({ block: 7 }) });
    const card = makeTestCard({ effects: [makeEffect("physical", 0, { equalToBlock: true })] });
    const result = dealDamage(state, card);
    expect(result.enemyHealth).toBeLessThanOrEqual(30 - 7);
  });

  it("damage equals armor plus forge when equalToArmor", () => {
    const state = patchBattleState({ playerStatuses: defaultPlayerStatusValues({ armor: 4 }) });
    const card = makeTestCard({ effects: [makeEffect("physical", 0, { equalToArmor: true })] });
    const result = dealDamage(state, card);
    expect(result.enemyHealth).toBeLessThanOrEqual(30 - 4);
  });
});

describe("dealDamageToEnemy — edge cases", () => {
  it("does not decrease health below 0", () => {
    const state = patchBattleState({ enemyHealth: 3 });
    const card = makeTestCard({ effects: [makeEffect("physical", 100)] });
    const result = dealDamage(state, card);
    expect(result.enemyHealth).toBe(0);
  });

  it("handles zero damage gracefully", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      enemyMitigation: { armor: 0, forge: 0, block: 0 },
    });
    const card = makeTestCard({ effects: [makeEffect("physical", 0)] });
    const result = dealDamage(state, card);
    expect(result.enemyHealth).toBe(30);
    expect(result.playerStatuses.forge).toBe(0);
  });
});

describe("applyFirstDamageModifiers", () => {
  it("increases first burn card damage by 50% when Wildfire talent active", () => {
    const state = patchBattleState({
      rng: () => 0.99,
      talentEffects: { ...defaultTalentEffects, firstBurnCardBonusMultiplier: 1.5 },
    });
    const card = makeTestCard({ effects: [makeEffect("burn", 5)] });
    const result = dealDamage(state, card);
    expect(result.flags.firstBurnCardDoubledUsed).toBe(true);
    expect(result.enemyHealth).toBe(22);
  });

  it("does not boost second burn card when Wildfire flag is used", () => {
    const state = patchBattleState({
      rng: () => 0.99,
      talentEffects: { ...defaultTalentEffects, firstBurnCardBonusMultiplier: 1.5 },
      flags: defaultCombatFlags({ firstBurnCardDoubledUsed: true }),
    });
    const card = makeTestCard({ effects: [makeEffect("burn", 5)] });
    const result = dealDamage(state, card);
    expect(result.flags.firstBurnCardDoubledUsed).toBe(true);
    expect(result.enemyHealth).toBe(25);
  });

  it("does not consume Wildfire when the multiplier is identity", () => {
    const state = patchBattleState({
      rng: () => 0.99,
      talentEffects: { ...defaultTalentEffects, firstBurnCardBonusMultiplier: 1 },
    });
    const card = makeTestCard({ effects: [makeEffect("burn", 5)] });
    const result = dealDamage(state, card);
    expect(result.flags.firstBurnCardDoubledUsed).toBe(false);
    expect(result.enemyHealth).toBe(25);
  });

  it("doubles first burn damage via boon effect", () => {
    const state = patchBattleState({
      rng: () => 0.99,
      trinketEffects: defaultTrinketManifest({ firstBurnDoubled: true }),
    });
    const card = makeTestCard({ effects: [makeEffect("burn", 5)] });
    const result = dealDamage(state, card);
    expect(result.flags.firstBurnTrinketDoubledUsed).toBe(true);
  });
});

const CHAIN_TYPES: DamageType[] = ["physical", "holy", "bleed", "stun", "burn", "freeze", "nature", "poison"];

describe("dealDamageToEnemy — full calc/rider/status chain per wound kind", () => {
  for (const damageType of CHAIN_TYPES) {
    it(`${damageType} reduces enemy health and emits matching damage text`, () => {
      const state = patchBattleState({ enemyHealth: 30, enemyMaxHealth: 30 });
      const card = makeTestCard({ effects: [makeEffect(damageType, 5)] });
      const texts = makeCombatTexts();
      const result = dealDamage(state, card, texts);
      expect(result.enemyHealth).toBeLessThan(30);
      expect(texts.some((t) => t.target === "enemy" && t.kind === "damage" && t.stat === damageType)).toBe(true);
    });
  }

  it("burn stacks burn equal to damage dealt", () => {
    const state = patchBattleState({ enemyHealth: 30, enemyMaxHealth: 30 });
    const result = dealDamage(state, makeTestCard({ effects: [makeEffect("burn", 5)] }));
    expect(result.enemyStatuses.burn).toBeGreaterThan(0);
  });

  it("poison stacks poison equal to damage dealt", () => {
    const state = patchBattleState({ enemyHealth: 30, enemyMaxHealth: 30 });
    const result = dealDamage(state, makeTestCard({ effects: [makeEffect("poison", 5)] }));
    expect(result.enemyStatuses.poison).toBeGreaterThan(0);
  });

  it("bleed stacks equal to damage as bleed", () => {
    const state = patchBattleState({ enemyHealth: 30, enemyMaxHealth: 30 });
    const result = dealDamage(state, makeTestCard({ effects: [makeEffect("bleed", 5)] }));
    expect(result.enemyStatuses.bleed).toBe(5);
  });

  it("freeze and stun build their own stacks", () => {
    const frozen = dealDamage(
      patchBattleState({ enemyHealth: 30, enemyMaxHealth: 30 }),
      makeTestCard({ effects: [makeEffect("freeze", 5)] }),
    );
    expect(frozen.enemyStatuses.freeze).toBeGreaterThan(0);
    const stunned = dealDamage(
      patchBattleState({ enemyHealth: 30, enemyMaxHealth: 30 }),
      makeTestCard({ effects: [makeEffect("stun", 5)] }),
    );
    expect(stunned.enemyStatuses.stun).toBeGreaterThan(0);
  });

  it("physical, holy and nature apply no enemy status by default", () => {
    for (const damageType of ["physical", "holy", "nature"] as const) {
      const state = patchBattleState({ enemyHealth: 30, enemyMaxHealth: 30 });
      const result = dealDamage(state, makeTestCard({ effects: [makeEffect(damageType, 5)] }));
      expect(result.enemyStatuses.burn).toBe(0);
      expect(result.enemyStatuses.poison).toBe(0);
      expect(result.enemyStatuses.bleed).toBe(0);
      expect(result.enemyStatuses.freeze).toBe(0);
      expect(result.enemyStatuses.stun).toBe(0);
    }
  });

  it("bleed with lifesteal queues leech that detonation pays as healing", () => {
    const state = patchBattleState({ enemyHealth: 30, enemyMaxHealth: 30, playerHealth: 20, playerMaxHealth: 30 });
    const afterHit = dealDamage(state, makeTestCard({ effects: [makeEffect("bleed", 5, { lifesteal: true })] }));
    expect(afterHit.pendingBleedLeechHealing).toBeGreaterThan(0);
    const texts = makeCombatTexts();
    const afterDetonate = detonateEnemyStatuses(afterHit, ["bleed"], texts);
    expect(afterDetonate.pendingBleedLeechHealing).toBe(0);
    expect(afterDetonate.playerHealth).toBeGreaterThan(20);
  });
});

describe("dealDamageToEnemy — enemy armor", () => {
  it("physical damage is reduced by enemy armor", () => {
    const state = patchBattleState({
      rng: () => 0.99,
      enemyMitigation: { armor: 3, forge: 0, block: 0 },
    });
    const card = makeTestCard({ effects: [makeEffect("physical", 10)] });
    const result = dealDamage(state, card);
    expect(result.enemyHealth).toBe(30 - 10 + 3);
  });

  it("sunderingArmorPiercing removes enemy armor", () => {
    const state = patchBattleState({
      rng: () => 0.99,
      enemyMitigation: { armor: 5, forge: 0, block: 0 },
      trinketEffects: defaultTrinketManifest({ sunderingArmorPiercing: 2 }),
    });
    const card = makeTestCard({ effects: [makeEffect("physical", 10)] });
    const result = dealDamage(state, card);
    expect(result.enemyHealth).toBe(23);
    expect(result.enemyMitigation.armor).toBe(2);
  });

  it("Piercing Shot ignores 1 Armor on Archery physical hits", () => {
    const state = patchBattleState({
      rng: () => 0.99,
      enemyMitigation: { armor: 3, forge: 0, block: 0 },
      talentEffects: { ...defaultTalentEffects, archeryArmorPiercing: 1 },
    });
    const card = makeTestCard({
      tags: ["archery"],
      effects: [makeEffect("physical", 10)],
    });
    const result = dealDamage(state, card);
    expect(result.enemyHealth).toBe(22);
    expect(result.enemyMitigation.armor).toBe(2);
  });

  it("non-physical damage ignores enemy armor", () => {
    const state = patchBattleState({
      rng: () => 0.99,
      enemyMitigation: { armor: 5, forge: 0, block: 0 },
    });
    const card = makeTestCard({ effects: [makeEffect("burn", 10)] });
    const result = dealDamage(state, card);
    expect(result.enemyHealth).toBe(20);
  });
});

describe("dealDamageToEnemy — boonSiphon siphoning", () => {
  it("steals armor and gains armor for the player when armor is siphoned", () => {
    const state = patchBattleState({
      enemyMitigation: { armor: 5, block: 0, forge: 0 },
      talentEffects: { ...defaultTalentEffects, trinketSiphonChance: 100 },
      rng: () => 0.1,
    });
    const card = makeTestCard({ effects: [makeEffect("physical", 10, { lifesteal: true })] });
    const result = dealDamage(state, card);
    expect(result.enemyMitigation.armor).toBe(3);
    expect(result.playerStatuses.armor).toBe(1);
  });

  it("steals forge and gains forge for the player when forge is siphoned", () => {
    const state = patchBattleState({
      enemyMitigation: { armor: 0, block: 0, forge: 3 },
      talentEffects: { ...defaultTalentEffects, trinketSiphonChance: 100 },
      rng: () => 0.1,
    });
    const card = makeTestCard({ effects: [makeEffect("nature", 10, { lifesteal: true })] });
    const result = dealDamage(state, card);
    expect(result.enemyMitigation.forge).toBe(2);
    expect(result.playerStatuses.forge).toBe(1);
  });
});
