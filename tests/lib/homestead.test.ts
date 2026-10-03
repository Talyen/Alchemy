import { describe, expect, it, vi } from "vitest";
import { MATERIAL_IDS } from "@/lib/homestead/types";
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
import { canUpgradeTierItem, getNextTierCost } from "@/lib/homestead/upgrades";

describe.each([
  { name: "buildings", items: buildings, hasTiers: true },
  { name: "farmPlots", items: farmPlots, hasTiers: true },
  { name: "researchUpgrades", items: researchUpgrades, hasTiers: true },
])("$name data integrity", ({ items, hasTiers }) => {
  it("each entry has required fields", () => {
    for (const item of items) {
      expect(item.title).toBeTruthy();
      if (hasTiers) expect(item.tiers.length).toBeGreaterThan(0);
    }
  });

  it("tier costs use only valid non-negative materials", () => {
    for (const item of items) {
      for (const tier of item.tiers ?? []) {
        for (const mat of Object.keys(tier.cost)) {
          expect(MATERIAL_IDS).toContain(mat);
        }
        for (const mat of MATERIAL_IDS) {
          expect(tier.cost[mat]).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });
});

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

  it("combines the four-tier specialties without the retired duplicate bonuses", () => {
    const effects = computeHomesteadEffects(
      { "blacksmiths-forge": 4, "runesmiths-workshop": 4, "hunters-lodge": 4, library: 4 },
      { "crystal-garden": 4, "herb-garden": 4 },
      { "leyline-energy": 4, "agility-training": 4, "detect-magic": 4 },
    );
    expect(effects).toMatchObject({
      flatPhysicalDamage: 4,
      homesteadForgeBurnPercent: 100,
      flatFreezeDamage: 4,
      flatHolyDamage: 4,
      flatNatureDamage: 4,
      flatArrowDamage: 0,
      homesteadCriticalDamage: 4,
      homesteadFreeManaChance: 20,
      dodgeChance: 8,
      companionDamage: 0,
      poisonDamageReduction: 4,
      removeCardDiscount: 8,
      endRunStonePerRoom: 4,
      gearAstralChanceBonus: 0.15,
    });
  });

  it("keeps every numeric bonus and production component increasing through four tiers", () => {
    for (const [items, kind] of [
      [buildings, "building"],
      [farmPlots, "farm"],
      [researchUpgrades, "research"],
    ] as const) {
      for (const item of items) {
        expect(item.tiers).toHaveLength(4);
        let previous = defaultHomesteadEffects;
        for (let level = 1; level <= 4; level++) {
          const record = { [item.id]: level };
          const effects = computeHomesteadEffects(
            kind === "building" ? record : {},
            kind === "farm" ? record : {},
            kind === "research" ? record : {},
          );
          for (const [key, value] of Object.entries(item.tiers[level - 1]!.effects!)) {
            if (typeof value === "number") {
              expect(value, `${item.id}: ${key}`).toBeGreaterThan(0);
              expect(effects[key as keyof typeof effects]).toBeGreaterThan(
                previous[key as keyof typeof previous] as number,
              );
            } else if (typeof value === "object") {
              for (const amount of Object.values(value)) expect(amount).toBeGreaterThan(0);
            }
          }
          previous = effects;
        }
      }
    }
  });

  it("stores Companion Bonds without adding global Companion damage", () => {
    const effects = computeHomesteadEffects({}, {}, {}, { wolf: 2 });
    expect(effects.companionBondLevels.wolf).toBe(2);
    expect(effects.companionDamage).toBe(0);
  });

  it("accumulates farm healing across tiers without sharing mutable defaults", () => {
    const effects = computeHomesteadEffects({}, { "wheat-field": 4, orchard: 2 }, {}, { wolf: 2 });
    expect(effects.cardHealBonus).toEqual({ bread: 8, apple: 4 });

    effects.cardHealBonus.bread = 99;
    effects.companionBondLevels.wolf = 99;
    const fresh = computeHomesteadEffects({}, {}, {});
    expect(fresh.cardHealBonus).toEqual({});
    expect(fresh.companionBondLevels.wolf).toBe(0);
  });
});

describe("mergeIntoManifest", () => {
  const makeTalentManifest = () => ({
    ...createEmptyTalentEffectManifest(),
    flatPhysicalDamage: 3,
    startGold: 10,
    startBlock: 2,
    campfireHealBonus: 0.1,
  });

  const makeHomesteadEffects = () => ({
    ...defaultHomesteadEffects,
    flatPhysicalDamage: 1,
    companionDamage: 1,
    companionBondLevels: { ...defaultHomesteadEffects.companionBondLevels, wolf: 2 },
    homesteadPotionBonus: 1,
  });

  it("adds homestead effects to talent effects", () => {
    const merged = mergeIntoManifest(makeTalentManifest(), makeHomesteadEffects());
    expect(merged.flatPhysicalDamage).toBe(4);
    expect(merged.startGold).toBe(10);
    expect(merged.startBlock).toBe(2);
    expect(merged.campfireHealBonus).toBeCloseTo(0.1);
    expect(merged.homesteadPotionBonus).toBe(1);
    expect(merged.companionBondLevels.wolf).toBe(2);
    expect(merged.healMultiplier).toBe(1);
    expect(merged.flatFreezeDamage).toBe(0);
    expect(merged.flatNatureDamage).toBe(0);
  });

  it("preserves non-merged talent fields", () => {
    const talent = makeTalentManifest();
    talent.firstBleedCardFree = true;
    talent.armorPhysicalDamagePercent = 100;
    const merged = mergeIntoManifest(talent, makeHomesteadEffects());
    expect(merged.firstBleedCardFree).toBe(true);
    expect(merged.armorPhysicalDamagePercent).toBe(100);
  });

  it("does not spread homestead-only fields into talent manifest", () => {
    const merged = mergeIntoManifest(makeTalentManifest(), makeHomesteadEffects());
    expect((merged as unknown as Record<string, unknown>).endRunFoodPerRoom).toBeUndefined();
  });

  it("adds card healing and takes the higher companion bond without mutating either manifest", () => {
    const talent = makeTalentManifest();
    talent.cardHealBonus = { bread: 3, apple: 1 };
    talent.companionBondLevels.wolf = 3;
    const homestead = {
      ...makeHomesteadEffects(),
      cardHealBonus: { bread: 2, potion: 4 },
    };
    const talentBefore = structuredClone(talent);
    const homesteadBefore = structuredClone(homestead);
    const merged = mergeIntoManifest(talent, homestead);
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

function stableRngZero(): () => number {
  return () => 0;
}

describe("getEnemyMaterialLoot", () => {
  it("returns empty inventory for unknown enemy", () => {
    const loot = getEnemyMaterialLoot("unknown", "normal", stableRngZero());
    for (const mat of MATERIAL_IDS) {
      expect(loot[mat]).toBe(0);
    }
  });

  it.each<{
    name: string;
    enemyId: string;
    expected: Record<string, number>;
  }>([
    {
      name: "goblin drops guaranteed wood and food plus its triggered wood bonus for normal type",
      enemyId: "goblin",
      expected: { wood: 2, food: 1 },
    },
    {
      name: "skeleton has no guaranteed materials but its triggered herb bonus pays",
      enemyId: "skeleton",
      expected: { wood: 0, iron: 0, herbs: 1, food: 0, gems: 0, stone: 0, hide: 0 },
    },
    {
      name: "necromancer drops guaranteed herbs and gems plus triggered bonuses",
      enemyId: "necromancer",
      expected: { herbs: 3, gems: 2, stone: 0, hide: 0 },
    },
  ])("$name", ({ enemyId, expected }) => {
    const loot = getEnemyMaterialLoot(enemyId, "normal", stableRngZero());
    for (const [mat, value] of Object.entries(expected)) {
      expect(loot[mat as keyof typeof loot]).toBe(value);
    }
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

describe("getEnemyMaterialLoot with elite multiplier", () => {
  it("applies 1.3x material multiplier for elite enemies", () => {
    const normal = getEnemyMaterialLoot("goblin", "normal", stableRngZero());
    const elite = getEnemyMaterialLoot("goblin", "elite", stableRngZero());
    expect(elite.wood).toBe(Math.round(normal.wood * 1.3));
    expect(elite.food).toBe(Math.round(normal.food * 1.3));
  });

  it("rounds elite multipliers instead of flooring singleton drops away", () => {
    const normal = getEnemyMaterialLoot("necromancer", "normal", stableRngZero());
    expect(normal.herbs).toBe(3);
    const elite = getEnemyMaterialLoot("necromancer", "elite", stableRngZero());
    expect(elite.herbs).toBe(4);
  });

  it("triples loot for boss enemies", () => {
    const normal = getEnemyMaterialLoot("goblin", "normal", stableRngZero());
    const boss = getEnemyMaterialLoot("goblin", "boss", stableRngZero());
    expect(boss.wood).toBe(normal.wood * 3);
    expect(boss.food).toBe(normal.food * 3);
  });
});

describe("getEnemyMaterialLoot with bonus rolls", () => {
  it("grants bonus materials when random rolls are favorable", () => {
    const rng = vi
      .fn()
      .mockReturnValueOnce(0.1)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.3)
      .mockReturnValueOnce(0.1);
    const loot = getEnemyMaterialLoot("mimic", "normal", rng);
    // Triggered bonuses always pay at least their minimum on top of guaranteed loot.
    expect(loot.iron).toBe(3);
    expect(loot.gems).toBe(1);
  });

  it("skips bonuses when random rolls fail", () => {
    const rng = vi.fn(() => 0.9);
    const loot = getEnemyMaterialLoot("mimic", "normal", rng);
    expect(loot.iron).toBe(2);
    expect(loot.gems).toBe(0);
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
      rng: stableRngZero(),
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
      rng: stableRngZero(),
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
  it("multiplies herb rewards and leaves other materials unchanged", () => {
    const result = applyMaterialFindBonus(
      { wood: 1, iron: 0, herbs: 10, food: 2, gems: 0, stone: 0, hide: 0 },
      { herbFindBonus: 0.3 },
    );
    expect(result.herbs).toBe(13);
    expect(result.wood).toBe(1);
    expect(result.food).toBe(2);
  });

  it("returns the same reward when no herbs are present", () => {
    const materials = { wood: 1, iron: 0, herbs: 0, food: 2, gems: 0, stone: 0, hide: 0 };
    expect(applyMaterialFindBonus(materials, { herbFindBonus: 0.3 })).toBe(materials);
  });

  it("rounds fractional herb bonuses instead of flooring them away", () => {
    const result = applyMaterialFindBonus(
      { wood: 0, iron: 0, herbs: 1, food: 0, gems: 0, stone: 0, hide: 0 },
      { herbFindBonus: 0.5 },
    );
    expect(result.herbs).toBe(2);
  });
});

describe("applyEndOfRunHomesteadBonuses", () => {
  it("applies flat end-of-run yields separately from herb find multiplier", () => {
    const base = { wood: 4, iron: 0, herbs: 10, food: 3, gems: 1, stone: 0, hide: 0 };
    const effects = {
      ...defaultHomesteadEffects,
      endRunFoodPerRoom: 2,
      endRunHerbsPerRoom: 1,
      endRunHidePerRoom: 2,
      endRunGemsPerRoom: 1,
      endRunIronPerRoom: 1,
      endRunWoodPerRoom: 2,
      herbFindBonus: 0.1,
    };
    const result = applyEndOfRunHomesteadBonuses(base, effects, 4);
    expect(result.food).toBe(3 + 8);
    expect(result.hide).toBe(0 + 8);
    expect(result.gems).toBe(1 + 4);
    expect(result.herbs).toBe(Math.floor((10 + 4) * 1.1));
    expect(result.iron).toBe(0 + 4);
    expect(result.wood).toBe(4 + 8);
  });

  it("does not add flat herbs when only herbFindBonus is set", () => {
    const base = { wood: 0, iron: 0, herbs: 10, food: 0, gems: 0, stone: 0, hide: 0 };
    const result = applyEndOfRunHomesteadBonuses(base, { ...defaultHomesteadEffects, herbFindBonus: 0.1 }, 5);
    expect(result.herbs).toBe(11);
  });
});

describe("homestead content integrity", () => {
  it("separates bonuses from room production at every tier", () => {
    for (const item of [...buildings, ...farmPlots, ...researchUpgrades]) {
      for (const tier of item.tiers) {
        expect(tier.benefitDescription).not.toContain("per Room");
        if (!tier.nonCombatBenefitDescription) continue;
        expect(tier.nonCombatBenefitDescription).toContain("per Room");
        const rates = Object.entries(tier.effects!).filter(([key]) => key.startsWith("endRun"));
        expect(rates.length).toBeGreaterThan(0);
        for (const [, value] of rates) expect(value).toBeGreaterThan(0);
      }
    }
  });
});

describe("upgrade tier helpers", () => {
  const building = buildings[0]!;

  it("getNextTierCost returns cost of next level and null when maxed", () => {
    expect(getNextTierCost(building, 0)).toEqual(building.tiers[0]!.cost);
    expect(getNextTierCost(building, 1)).toEqual(building.tiers[1]!.cost);
    expect(getNextTierCost(building, building.tiers.length)).toBeNull();
    expect(getNextTierCost(undefined, 0)).toBeNull();
    expect(getNextTierCost(building, -1)).toBeNull();
  });

  it("canUpgradeTierItem checks affordability and level bounds", () => {
    const cost = building.tiers[0]!.cost;
    expect(canUpgradeTierItem(building, 0, cost)).toBe(true);
    expect(canUpgradeTierItem(building, 0, emptyInventory())).toBe(false);
    expect(canUpgradeTierItem(building, building.tiers.length, cost)).toBe(false);
    expect(canUpgradeTierItem(undefined, 0, cost)).toBe(false);
  });
});
