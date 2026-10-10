import { describe, expect, it, vi } from "vitest";
import { emptyInventory } from "@/lib/homestead/inventory";
import { defaultHomesteadEffects } from "@/lib/homestead/defaults";
import { buildings, farmPlots, researchUpgrades } from "@/lib/homestead/data";
import { computeHomesteadEffects, mergeIntoManifest } from "@/lib/homestead/effects";
import {
  applyEndOfRunHomesteadBonuses,
  applyMaterialFindBonus,
  computeCombatMaterialReward,
  computeMysteryMaterialReward,
  enemyLootTableIds,
  enemyLootTables,
  getEnemyMaterialLoot,
} from "@/lib/homestead/material-rewards";
import { enemyBestiary } from "@/lib/game-data/compendium/enemies";
import { createEmptyTalentEffectManifest } from "@/lib/game-data";
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

  it("accumulates farm healing across tiers without sharing mutable defaults", () => {
    const effects = computeHomesteadEffects({}, { "wheat-field": 4, orchard: 2 }, {}, { wolf: 2 });
    expect(effects.cardHealBonus).toEqual({ bread: 8, apple: 4 });
    expect(effects.companionBondLevels.wolf).toBe(2);
    expect(effects.companionDamage).toBe(0);

    effects.cardHealBonus.bread = 99;
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
    talent.firstBleedCardFree = true;
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
      firstBleedCardFree: true,
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

describe("getEnemyMaterialLoot", () => {
  it("returns empty inventory for unknown enemy", () => {
    const loot = getEnemyMaterialLoot("unknown", "normal", () => 0);
    expect(loot).toEqual(emptyInventory());
  });

  it("pays guaranteed loot, successful bonuses, and type scaling without changing the catalog", () => {
    const before = structuredClone(enemyLootTables.mimic);
    const rng = vi.fn().mockReturnValueOnce(0.1).mockReturnValueOnce(0.5).mockReturnValueOnce(0.4);
    expect(getEnemyMaterialLoot("mimic", "elite", rng)).toEqual({ ...emptyInventory(), iron: 3, gems: 1 });
    expect(rng).toHaveBeenCalledTimes(3);
    expect(getEnemyMaterialLoot("mimic", "boss", () => 0.9)).toEqual({ ...emptyInventory(), iron: 6 });
    expect(enemyLootTables.mimic).toEqual(before);
  });
});

describe("enemy loot parity", () => {
  it("every bestiary enemy has a loot table and vice versa", () => {
    const bestiaryIds = enemyBestiary.map((enemy) => enemy.id).sort();
    const lootIds = [...enemyLootTableIds].sort();
    expect(lootIds).toEqual(bestiaryIds);
  });

  it("keeps material bonus entries well-shaped", () => {
    for (const [enemyId, table] of Object.entries(enemyLootTables)) {
      for (const bonus of table.bonuses) {
        // A triggered bonus always pays: min ≥ 1 keeps the chance honest.
        expect(bonus.min, `${enemyId}.${bonus.material} min`).toBeGreaterThanOrEqual(1);
        expect(bonus.min, `${enemyId}.${bonus.material} range`).toBeLessThanOrEqual(bonus.max);
        expect(bonus.chance, `${enemyId}.${bonus.material} chance`).toBeGreaterThan(0);
        expect(bonus.chance, `${enemyId}.${bonus.material} chance`).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("computeCombatMaterialReward", () => {
  it("applies table, herb-find, scavenger, then herbalist in order", () => {
    // Bandit with every roll hitting: guaranteed 1 wood + 1 food, bonuses +1 wood +1 hide.
    const result = computeCombatMaterialReward({
      enemyId: "bandit",
      enemyType: "normal",
      effects: { herbFindBonus: 0 },
      scavenger: true,
      herbalist: true,
      rng: () => 0,
    });
    expect(result.wood).toBe(4);
    expect(result.food).toBe(2);
    expect(result.hide).toBe(2);
    // Herbalist tops up already-doubled herbs instead of being doubled itself.
    expect(result.herbs).toBe(3);
  });

  it("stacks herb-find before scavenger", () => {
    const result = computeCombatMaterialReward({
      enemyId: "skeleton",
      enemyType: "normal",
      effects: { herbFindBonus: 1 },
      scavenger: true,
      herbalist: false,
      rng: () => 0,
    });
    expect(result.herbs).toBe(4);
  });
});

describe("computeMysteryMaterialReward", () => {
  it("applies only the herb-find bonus to a fixed grant", () => {
    expect(computeMysteryMaterialReward({ material: "herbs", amount: 2, effects: { herbFindBonus: 0.5 } }).herbs).toBe(
      3,
    );
    const iron = computeMysteryMaterialReward({ material: "iron", amount: 2, effects: { herbFindBonus: 0.5 } });
    expect(iron.iron).toBe(2);
    expect(iron.herbs).toBe(0);
  });
});

describe("applyMaterialFindBonus", () => {
  it("rounds fractional herb bonuses without changing other rewards or its input", () => {
    const base = { ...emptyInventory(), wood: 2, herbs: 1 };
    expect(applyMaterialFindBonus(base, { herbFindBonus: 0.5 })).toEqual({ ...base, herbs: 2 });
    expect(base).toEqual({ ...emptyInventory(), wood: 2, herbs: 1 });
  });
});

describe("applyEndOfRunHomesteadBonuses", () => {
  it("applies flat end-of-run yields separately from herb find multiplier", () => {
    const base = { wood: 4, iron: 0, herbs: 10, food: 3, gems: 1, stone: 0, hide: 0 };
    const effects = {
      ...defaultHomesteadEffects,
      endRunStonePerRoom: 3,
      endRunWishPerRoom: 2,
      endRunFoodPerRoom: 2,
      endRunHerbsPerRoom: 1,
      endRunHidePerRoom: 2,
      endRunGemsPerRoom: 1,
      endRunIronPerRoom: 1,
      endRunWoodPerRoom: 2,
      herbFindBonus: 0.1,
    };
    const result = applyEndOfRunHomesteadBonuses(base, effects, 4);
    expect(result).toEqual({ wood: 12, iron: 4, herbs: 15, food: 11, gems: 9, stone: 12, hide: 8 });
    expect(applyEndOfRunHomesteadBonuses(base, effects, 3).gems).toBe(6);
    expect(applyEndOfRunHomesteadBonuses(base, effects, -1)).toEqual({ ...base, herbs: 11 });
    expect(base).toEqual({ wood: 4, iron: 0, herbs: 10, food: 3, gems: 1, stone: 0, hide: 0 });
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
