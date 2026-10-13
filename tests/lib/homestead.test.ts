import { describe, expect, it, vi } from "vitest";
import { emptyInventory } from "@/lib/homestead/inventory";
import { defaultHomesteadEffects } from "@/lib/homestead/defaults";
import { buildings, farmPlots, researchUpgrades } from "@/lib/homestead/data";
import { computeHomesteadEffects, mergeIntoManifest } from "@/lib/homestead/effects";
import {
  applyRewardFindBonus,
  applyMaterialFindBonus,
  computeCombatMaterialReward,
  computeGoldReward,
  computeMysteryMaterialReward,
  getCombatMaterialLoot,
} from "@/lib/homestead/material-rewards";
import { createEmptyTalentEffectManifest } from "@/lib/game-data";
import { MATERIAL_IDS } from "@/lib/homestead/types";
import { createSeededRng } from "@/lib/rng";
import { tryUpgradeTierItem } from "@/lib/homestead/upgrades";

describe("homestead upgrade IDs cross-category uniqueness", () => {
  it("all IDs across buildings, farmPlots, and researchUpgrades are mutually unique", () => {
    const allIds = [...buildings.map((b) => b.id), ...farmPlots.map((f) => f.id), ...researchUpgrades.map((r) => r.id)];
    expect(new Set(allIds).size).toBe(allIds.length);
  });
});

describe("computeHomesteadEffects", () => {
  it("returns defaults and ignores unknown IDs", () => {
    expect(computeHomesteadEffects({ unknown: 4 }, {}, { unknown: 4 })).toEqual(defaultHomesteadEffects);
  });

  it("caps restored upgrades at the authored tiers without losing fractional bonuses", () => {
    const capped = computeHomesteadEffects({ "blacksmiths-forge": 99 }, {}, { "detect-magic": 99 });
    expect(capped).toMatchObject({
      flatPhysicalDamage: 4,
      homesteadForgeBurnPercent: 40,
      gearAstralChanceBonus: 0.15,
    });
    expect(computeHomesteadEffects({ "blacksmiths-forge": -1 }, {}, {})).toEqual(defaultHomesteadEffects);
  });

  it("accumulates purchased farm effects and resource bonuses without sharing mutable defaults", () => {
    const effects = computeHomesteadEffects({}, { "wheat-field": 4, orchard: 2 }, {}, { wolf: 2 });
    expect(effects.healthRestorePerCombat).toBe(4);
    expect(effects.startThorns).toBe(2);
    expect(effects.foodFindBonus).toBe(0.6);
    expect(effects.cardHealBonus).toEqual({});
    expect(effects.companionBondLevels.wolf).toBe(2);
    expect(effects.companionDamage).toBe(0);

    effects.foodFindBonus = 99;
    effects.companionBondLevels.wolf = 99;
    const fresh = computeHomesteadEffects({}, {}, {});
    expect(fresh.cardHealBonus).toEqual({});
    expect(fresh.companionBondLevels.wolf).toBe(0);
  });
});

describe("mergeIntoManifest", () => {
  it("adds card healing and takes the higher companion bond without mutating either manifest", () => {
    const talent = {
      ...createEmptyTalentEffectManifest(),
      flatPhysicalDamage: 3,
      startGold: 10,
      startBlock: 2,
      campfireHealBonus: 0.1,
    };
    talent.firstBurnCardFree = true;
    talent.armorPhysicalDamagePercent = 100;
    talent.cardHealBonus = { bread: 3, apple: 1 };
    talent.companionBondLevels.wolf = 3;
    const homestead = {
      ...defaultHomesteadEffects,
      flatPhysicalDamage: 1,
      companionBondLevels: { ...defaultHomesteadEffects.companionBondLevels, wolf: 2 },
      homesteadPotionBonus: 1,
      cardHealBonus: { bread: 2, potion: 4 },
    };
    const talentBefore = structuredClone(talent);
    const homesteadBefore = structuredClone(homestead);
    const merged = mergeIntoManifest(talent, homestead);
    expect(merged).toMatchObject({
      flatPhysicalDamage: 4,
      startGold: 10,
      startBlock: 2,
      campfireHealBonus: 0.1,
      firstBurnCardFree: true,
      armorPhysicalDamagePercent: 100,
      homesteadPotionBonus: 1,
    });
    expect(merged).not.toHaveProperty("endRunFoodPerRoom");
    expect(merged.cardHealBonus).toEqual({
      bread: 5,
      apple: 1,
      potion: 4,
    });
    expect(merged.companionBondLevels.wolf).toBe(3);
    expect(talent).toEqual(talentBefore);
    expect(homestead).toEqual(homesteadBefore);
    merged.cardHealBonus.bread = 99;
    merged.companionBondLevels.wolf = 99;
    const withoutBonuses = mergeIntoManifest(talent, defaultHomesteadEffects);
    withoutBonuses.cardHealBonus.bread = 99;
    withoutBonuses.companionBondLevels.wolf = 99;
    expect(talent).toEqual(talentBefore);
    expect(homestead).toEqual(homesteadBefore);
  });
});

describe("shared combat material loot", () => {
  it.each([
    ["normal", [3, 4, 5]],
    ["elite", [5, 6, 7]],
    ["boss", [8, 10, 12]],
  ] as const)("keeps the %s payout budget across progression bands", (type, quantities) => {
    for (const [index, quantity] of quantities.entries()) {
      const rng = vi.fn(createSeededRng(42));
      const loot = getCombatMaterialLoot(type, index + 1, rng);
      expect(Object.values(loot).reduce((sum, value) => sum + value, 0)).toBe(quantity);
      expect(rng).toHaveBeenCalledTimes(Math.ceil(quantity / 2));
      expect(getCombatMaterialLoot(type, index + 1, createSeededRng(42))).toEqual(loot);
    }
  });

  it("selects each material uniformly in two-unit bundles with a final singleton", () => {
    for (const [index, material] of MATERIAL_IDS.entries()) {
      const rng = vi
        .fn()
        .mockReturnValueOnce((index + 0.5) / MATERIAL_IDS.length)
        .mockReturnValueOnce(0.999);
      const expected = emptyInventory();
      expected[material] += 2;
      expected.gems += 1;
      expect(getCombatMaterialLoot("normal", 1, rng)).toEqual(expected);
    }
    expect(getCombatMaterialLoot("boss", 3, () => 0)).toEqual({ ...emptyInventory(), wood: 12 });
  });

  it("caps long runs at band three and treats the opening as band one", () => {
    expect(getCombatMaterialLoot("elite", 99, () => 0)).toEqual({ ...emptyInventory(), wood: 7 });
    expect(getCombatMaterialLoot("normal", 0, () => 0)).toEqual({ ...emptyInventory(), wood: 3 });
  });
});

describe("computeCombatMaterialReward", () => {
  it("doubles the shared payout before adding the herbalist bonus", () => {
    const result = computeCombatMaterialReward({
      progressionBand: 1,
      enemyType: "normal",
      effects: { ...defaultHomesteadEffects, herbFindBonus: 0 },
      scavenger: true,
      herbalist: true,
      rng: () => 0,
    });
    expect(result.wood).toBe(6);
    expect(result.food).toBe(0);
    expect(result.hide).toBe(0);
    // Herbalist tops up already-doubled herbs instead of being doubled itself.
    expect(result.herbs).toBe(3);
  });

  it("applies find bonuses after all location modifiers", () => {
    const result = computeCombatMaterialReward({
      progressionBand: 1,
      enemyType: "normal",
      effects: { ...defaultHomesteadEffects, herbFindBonus: 0.5 },
      scavenger: true,
      herbalist: false,
      rng: () => 4.5 / MATERIAL_IDS.length,
    });
    expect(result.herbs).toBe(9);
  });
});

describe("computeMysteryMaterialReward", () => {
  it("applies only the herb-find bonus to a fixed grant", () => {
    expect(
      computeMysteryMaterialReward({
        material: "herbs",
        amount: 2,
        effects: { ...defaultHomesteadEffects, herbFindBonus: 0.5 },
      }).herbs,
    ).toBe(3);
    const iron = computeMysteryMaterialReward({
      material: "iron",
      amount: 2,
      effects: { ...defaultHomesteadEffects, herbFindBonus: 0.5 },
    });
    expect(iron.iron).toBe(2);
    expect(iron.herbs).toBe(0);
  });
});

describe("applyMaterialFindBonus", () => {
  it("rounds fractional herb bonuses without changing other rewards or its input", () => {
    const base = { ...emptyInventory(), wood: 2, herbs: 1 };
    expect(applyMaterialFindBonus(base, { ...defaultHomesteadEffects, herbFindBonus: 0.5 })).toEqual({
      ...base,
      herbs: 2,
    });
    expect(base).toEqual({ ...emptyInventory(), wood: 2, herbs: 1 });
  });
});

describe("reward quantity bonuses", () => {
  it("boosts the resolved Gold payout after ordinary scaling and preserves zero rewards", () => {
    expect(computeGoldReward(3, 1.5, 0.1)).toBe(6);
    expect(computeGoldReward(3, 1.5, 0)).toBe(5);
    expect(computeGoldReward(0, 1.5, 0.4)).toBe(0);
  });
  it.each([1, 2, 3, 4])("applies tier %i to matching resources and stacks different nodes additively", (tier) => {
    const buildingsOnly = computeHomesteadEffects({ "hunters-lodge": tier, "wishing-well": tier }, {}, {});
    expect(buildingsOnly.foodFindBonus).toBe(0);
    expect(buildingsOnly.gemFindBonus).toBe(0);
    expect(buildingsOnly.hideFindBonus).toBeCloseTo(tier * 0.1);
    expect(buildingsOnly.goldFindBonus).toBeCloseTo(tier * 0.1);
    const effects = computeHomesteadEffects(
      { "hunters-lodge": tier, "wishing-well": tier },
      { "wheat-field": tier, "crystal-garden": tier },
      { "wool-tailoring": tier },
    );
    expect(effects.foodFindBonus).toBeCloseTo(tier * 0.1);
    expect(effects.gemFindBonus).toBeCloseTo(tier * 0.1);
    expect(effects.goldFindBonus).toBeCloseTo(tier * 0.2);
    const base = { ...emptyInventory(), food: 10, gems: 10, stone: 10, hide: 10 };
    expect(applyMaterialFindBonus(base, effects)).toEqual({
      ...base,
      food: 10 + tier,
      gems: 10 + tier,
      stone: 10 + tier,
      hide: 10 + tier,
    });
    expect(base.food).toBe(10);
  });

  it("rounds source quantities once, preserves empty payouts, and boosts every supported material", () => {
    const effects = {
      ...defaultHomesteadEffects,
      woodFindBonus: 0.1,
      stoneFindBonus: 0.2,
      ironFindBonus: 0.3,
      foodFindBonus: 0.4,
      herbFindBonus: 0.5,
      hideFindBonus: 0.6,
      gemFindBonus: 0.7,
    };
    expect(applyMaterialFindBonus(emptyInventory(), effects)).toEqual(emptyInventory());
    expect(
      applyMaterialFindBonus({ wood: 10, stone: 10, iron: 10, food: 10, herbs: 10, hide: 10, gems: 10 }, effects),
    ).toEqual({ wood: 11, stone: 12, iron: 13, food: 14, herbs: 15, hide: 16, gems: 17 });
    expect(applyRewardFindBonus(1, 0.1)).toBe(1);
    expect(applyRewardFindBonus(5, 0.1)).toBe(6);
    expect(applyRewardFindBonus(0, 0.4)).toBe(0);
  });
});

describe("Homestead upgrade payment", () => {
  it("spends exactly the next tier cost once and rejects unaffordable or completed upgrades", () => {
    const building = buildings[0]!;
    const inventory = { ...building.tiers[0]!.cost };
    const before = { ...inventory };
    const result = tryUpgradeTierItem(building, 0, inventory);
    expect(result).toEqual({ ok: true, inventory: emptyInventory(), nextLevel: 1 });
    expect(inventory).toEqual(before);
    expect(tryUpgradeTierItem(building, 1, result.inventory)).toEqual({ ...result, ok: false });
    expect(tryUpgradeTierItem(building, building.tiers.length, inventory)).toEqual({
      ok: false,
      inventory,
      nextLevel: building.tiers.length,
    });
    expect(tryUpgradeTierItem(undefined, 0, inventory)).toEqual({ ok: false, inventory, nextLevel: 0 });
  });
});
