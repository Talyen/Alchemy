import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  MATERIAL_IDS, materialLabels, materialIcons,
} from "@/lib/homestead/types";
import { emptyInventory, addInventory, canAfford, subtractInventory } from "@/lib/homestead/inventory";
import { defaultHomesteadEffects } from "@/lib/homestead/defaults";
import { buildings, farmPlots, researchUpgrades } from "@/lib/homestead/data";
import { computeHomesteadEffects, mergeIntoManifest } from "@/lib/homestead/effects";
import { applyMaterialFindBonus, getEnemyMaterialLoot, getEndOfRunMaterials } from "@/lib/homestead/loot";
import { createEmptyTalentManifest } from "@/lib/game-data";

// ─── types ──────────────────────────────────────────────────────

describe("emptyInventory", () => {
  it("returns all materials at 0", () => {
    const inv = emptyInventory();
    for (const mat of MATERIAL_IDS) {
      expect(inv[mat]).toBe(0);
    }
  });

  it("has exactly the material keys", () => {
    expect(Object.keys(emptyInventory())).toEqual(MATERIAL_IDS);
  });
});

describe("addInventory", () => {
  it("adds two inventories", () => {
    const a = { wood: 2, iron: 3, herbs: 0, food: 1, crystal: 0 };
    const b = { wood: 1, iron: 0, herbs: 4, food: 0, crystal: 2 };
    const result = addInventory(a, b);
    expect(result.wood).toBe(3);
    expect(result.iron).toBe(3);
    expect(result.herbs).toBe(4);
    expect(result.food).toBe(1);
    expect(result.crystal).toBe(2);
  });

  it("does not mutate inputs", () => {
    const a = { wood: 1, iron: 0, herbs: 0, food: 0, crystal: 0 };
    const b = { wood: 1, iron: 0, herbs: 0, food: 0, crystal: 0 };
    addInventory(a, b);
    expect(a.wood).toBe(1);
  });

  it("handles missing keys as 0", () => {
    const a = emptyInventory();
    const b = { wood: 2 } as typeof a;
    const result = addInventory(a, b);
    expect(result.wood).toBe(2);
  });
});

describe("canAfford", () => {
  it("returns true when inventory meets cost", () => {
    const inv = { wood: 5, iron: 5, herbs: 5, food: 5, crystal: 5 };
    const cost = { wood: 3, iron: 2, herbs: 0, food: 1, crystal: 0 };
    expect(canAfford(inv, cost)).toBe(true);
  });

  it("returns false when inventory is short", () => {
    const inv = { wood: 1, iron: 0, herbs: 0, food: 0, crystal: 0 };
    const cost = { wood: 5, iron: 0, herbs: 0, food: 0, crystal: 0 };
    expect(canAfford(inv, cost)).toBe(false);
  });

  it("handles missing cost keys as 0", () => {
    const inv = { wood: 3, iron: 0, herbs: 0, food: 0, crystal: 0 };
    const cost = { wood: 3 } as ReturnType<typeof emptyInventory>;
    expect(canAfford(inv, cost)).toBe(true);
  });
});

describe("subtractInventory", () => {
  it("subtracts cost from inventory", () => {
    const inv = { wood: 5, iron: 5, herbs: 5, food: 5, crystal: 5 };
    const cost = { wood: 2, iron: 1, herbs: 0, food: 3, crystal: 0 };
    const result = subtractInventory(inv, cost);
    expect(result.wood).toBe(3);
    expect(result.iron).toBe(4);
    expect(result.food).toBe(2);
  });

  it("clamps to 0 (no negative materials)", () => {
    const inv = { wood: 1, iron: 0, herbs: 0, food: 0, crystal: 0 };
    const cost = { wood: 5, iron: 0, herbs: 0, food: 0, crystal: 0 };
    const result = subtractInventory(inv, cost);
    expect(result.wood).toBe(0);
  });

  it("does not mutate inputs", () => {
    const inv = { wood: 3, iron: 0, herbs: 0, food: 0, crystal: 0 };
    subtractInventory(inv, { wood: 1 } as ReturnType<typeof emptyInventory>);
    expect(inv.wood).toBe(3);
  });
});

describe("MATERIAL_IDS and labels", () => {
  it("every material has a label", () => {
    for (const mat of MATERIAL_IDS) {
      expect(materialLabels[mat]).toBeTruthy();
    }
  });

  it("every material has an icon", () => {
    for (const mat of MATERIAL_IDS) {
      expect(materialIcons[mat]).toBeTruthy();
    }
  });
});

describe("defaultHomesteadEffects", () => {
  it("all values are at default (0 or false)", () => {
    expect(defaultHomesteadEffects.flatPhysicalDamage).toBe(0);
    expect(defaultHomesteadEffects.companionDamage).toBe(0);
    expect(defaultHomesteadEffects.companionBondLevels.wolf).toBe(0);
    expect(defaultHomesteadEffects.forgeToBurn).toBe(false);
  });
});

// ─── data integrity ─────────────────────────────────────────────

describe("buildings data integrity", () => {
  it("all building IDs are unique", () => {
    const ids = buildings.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("each building has required fields", () => {
    for (const b of buildings) {
      expect(b.title).toBeTruthy();
      expect(typeof b.description).toBe("string");
      expect(b.buttonLabel).toBeTruthy();
      expect(b.tiers.length).toBeGreaterThan(0);
    }
  });

  it("each building tier cost uses only valid materials", () => {
    for (const b of buildings) {
      for (const tier of b.tiers) {
        for (const mat of Object.keys(tier.cost)) {
          expect(MATERIAL_IDS).toContain(mat);
        }
      }
    }
  });

  it("each building tier cost is non-negative", () => {
    for (const b of buildings) {
      for (const tier of b.tiers) {
        for (const mat of MATERIAL_IDS) {
          expect(tier.cost[mat]).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });
});

describe("farmPlots data integrity", () => {
  it("all farm IDs are unique", () => {
    const ids = farmPlots.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("each farm has required fields", () => {
    for (const f of farmPlots) {
      expect(f.title).toBeTruthy();
      expect(typeof f.description).toBe("string");
      expect(f.yield).toBeDefined();
      expect(f.buttonLabel).toBeTruthy();
    }
  });

  it("each farm cost and yield use only valid materials", () => {
    for (const f of farmPlots) {
      for (const tier of f.tiers) {
        for (const mat of Object.keys(tier.cost).concat(Object.keys(f.yield))) {
          expect(MATERIAL_IDS).toContain(mat);
        }
      }
    }
  });

  it("each farm yield is non-negative", () => {
    for (const f of farmPlots) {
      for (const mat of MATERIAL_IDS) {
        expect(f.yield[mat]).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe("researchUpgrades data integrity", () => {
  it("all research IDs are unique", () => {
    const ids = researchUpgrades.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("each research has required fields", () => {
    for (const r of researchUpgrades) {
      expect(r.title).toBeTruthy();
      expect(typeof r.description).toBe("string");
      expect(r.buttonLabel).toBeTruthy();
      expect(r.tiers.length).toBeGreaterThan(0);
    }
  });
});

// ─── effects ────────────────────────────────────────────────────

describe("computeHomesteadEffects", () => {
  it("returns defaults for empty inputs", () => {
    const effects = computeHomesteadEffects({}, {}, {});
    expect(effects).toEqual(defaultHomesteadEffects);
  });

  it("blacksmiths-forge adds flatPhysicalDamage and forgeToBurn", () => {
    const effects = computeHomesteadEffects({ "blacksmiths-forge": 1 }, {}, {});
    expect(effects.flatPhysicalDamage).toBe(1);
    expect(effects.forgeToBurn).toBe(true);
  });

  it("combines multiple tiered upgrades", () => {
    const effects = computeHomesteadEffects({ "blacksmiths-forge": 2, "hunters-lodge": 1, "alchemy-lab": 3 }, {}, {});
    expect(effects.flatPhysicalDamage).toBe(2);
    expect(effects.forgeToBurn).toBe(true);
    expect(effects.companionDamage).toBe(1);
    expect(effects.potionPotency).toBeCloseTo(0.5);
  });

  it("ignores unknown building IDs", () => {
    const effects = computeHomesteadEffects({ "nonexistent-building": 1 }, {}, {});
    expect(effects).toEqual(defaultHomesteadEffects);
  });

  it("ignores unknown research IDs", () => {
    const effects = computeHomesteadEffects({}, {}, { "nonexistent-research": 1 });
    expect(effects).toEqual(defaultHomesteadEffects);
  });

  it("stores companion bond levels without adding global companion damage", () => {
    const effects = computeHomesteadEffects({}, {}, {}, { wolf: 2, imp: 1 });
    expect(effects.companionDamage).toBe(0);
    expect(effects.companionBondLevels.wolf).toBe(2);
    expect(effects.companionBondLevels.imp).toBe(1);
  });
});

describe("mergeIntoManifest", () => {
  const makeTalentManifest = () => ({ ...createEmptyTalentManifest(), flatPhysicalDamage: 3, startGold: 10, startBlock: 2, campfireHealBonus: 0.1, physicalCritChance: 5 });

  const makeHomesteadEffects = () => ({
    ...defaultHomesteadEffects,
    flatPhysicalDamage: 1,
    companionDamage: 1,
    companionBondLevels: { ...defaultHomesteadEffects.companionBondLevels, wolf: 2 },
    forgeToBurn: true,
    potionHealMultiplier: 0.2,
    potionManaBonus: 1,
    potionDiscount: 0.1,
    startGold: 5,
    startBlock: 3,
    campfireHealBonus: 0.05,
    physicalCritChance: 2,
    startMaxHealthBonus: 5,
  });

  it("adds homestead effects to talent effects", () => {
    const merged = mergeIntoManifest(makeTalentManifest(), makeHomesteadEffects());
    expect(merged.flatPhysicalDamage).toBe(4);
    expect(merged.startGold).toBe(15);
    expect(merged.startBlock).toBe(5);
    expect(merged.campfireHealBonus).toBeCloseTo(0.15);
    expect(merged.physicalCritChance).toBe(7);
    expect(merged.potionDiscount).toBeCloseTo(0.1);
    expect(merged.potionManaBonus).toBe(1);
    expect(merged.companionBondLevels.wolf).toBe(2);
    expect(merged.forgeToBurn).toBe(true);
    expect(merged.healMultiplier).toBe(1);
  });

  it("preserves non-merged talent fields", () => {
    const talent = makeTalentManifest();
    talent.firstBleedCardFree = true;
    talent.armorToPhysicalDamage = true;
    const merged = mergeIntoManifest(talent, makeHomesteadEffects());
    expect(merged.firstBleedCardFree).toBe(true);
    expect(merged.armorToPhysicalDamage).toBe(true);
  });

  it("does not spread homestead-only fields into talent manifest", () => {
    const merged = mergeIntoManifest(makeTalentManifest(), makeHomesteadEffects());
    expect((merged as Record<string, unknown>).startMaxHealthBonus).toBeUndefined();
  });
});

// ─── loot ───────────────────────────────────────────────────────

describe("getEnemyMaterialLoot", () => {
  beforeEach(() => {
    vi.spyOn(Math, "random").mockReturnValue(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty inventory for unknown enemy", () => {
    const loot = getEnemyMaterialLoot("unknown", "normal");
    for (const mat of MATERIAL_IDS) {
      expect(loot[mat]).toBe(0);
    }
  });

  it("goblin drops guaranteed wood and food for normal type", () => {
    const loot = getEnemyMaterialLoot("goblin", "normal");
    expect(loot.wood).toBe(1);
    expect(loot.food).toBe(1);
  });

  it("skeleton has no guaranteed materials", () => {
    const loot = getEnemyMaterialLoot("skeleton", "normal");
    expect(loot.wood).toBe(0);
    expect(loot.iron).toBe(0);
    expect(loot.herbs).toBe(0);
    expect(loot.food).toBe(0);
    expect(loot.crystal).toBe(0);
  });

  it("necromancer drops guaranteed herbs and crystal", () => {
    const loot = getEnemyMaterialLoot("necromancer", "normal");
    expect(loot.herbs).toBe(2);
    expect(loot.crystal).toBe(1);
  });
});

describe("getEnemyMaterialLoot with elite multiplier", () => {
  beforeEach(() => {
    vi.spyOn(Math, "random").mockReturnValue(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("applies 1.3x material multiplier for elite enemies", () => {
    const normal = getEnemyMaterialLoot("goblin", "normal");
    const elite = getEnemyMaterialLoot("goblin", "elite");
    expect(elite.wood).toBe(Math.floor(normal.wood * 1.3));
    expect(elite.food).toBe(Math.floor(normal.food * 1.3));
  });

  it("triples loot for boss enemies", () => {
    const normal = getEnemyMaterialLoot("goblin", "normal");
    const boss = getEnemyMaterialLoot("goblin", "boss");
    expect(boss.wood).toBe(normal.wood * 3);
    expect(boss.food).toBe(normal.food * 3);
  });
});

describe("getEnemyMaterialLoot with bonus rolls", () => {
  it("grants bonus materials when random rolls are favorable", () => {
    vi.spyOn(Math, "random").mockReturnValueOnce(0.1).mockReturnValueOnce(0.5);
    const loot = getEnemyMaterialLoot("mimic", "normal");
    expect(loot.iron).toBeGreaterThanOrEqual(2);
    expect(loot.crystal).toBeGreaterThanOrEqual(0);
  });

  it("skips bonuses when random rolls fail", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.9);
    const loot = getEnemyMaterialLoot("mimic", "normal");
    expect(loot.iron).toBe(2);
    expect(loot.crystal).toBe(0);
  });
});

describe("applyMaterialFindBonus", () => {
  it("multiplies herb rewards and leaves other materials unchanged", () => {
    const result = applyMaterialFindBonus({ wood: 1, iron: 0, herbs: 10, food: 2, crystal: 0 }, { herbFindBonus: 0.3 });
    expect(result.herbs).toBe(13);
    expect(result.wood).toBe(1);
    expect(result.food).toBe(2);
  });

  it("returns the same reward when no herbs are present", () => {
    const materials = { wood: 1, iron: 0, herbs: 0, food: 2, crystal: 0 };
    expect(applyMaterialFindBonus(materials, { herbFindBonus: 0.3 })).toBe(materials);
  });
});

describe("getEndOfRunMaterials", () => {
  it("returns zero for zero rooms", () => {
    const loot = getEndOfRunMaterials(0, 1);
    expect(loot.wood).toBe(0);
    expect(loot.iron).toBe(0);
    expect(loot.herbs).toBe(0);
    expect(loot.food).toBe(0);
    expect(loot.crystal).toBe(0);
  });

  it("scales with rooms encountered", () => {
    const loot = getEndOfRunMaterials(10, 1);
    expect(loot.wood).toBe(20);
    expect(loot.iron).toBe(10 + Math.floor(10 * 1.5));
    expect(loot.herbs).toBe(10);
    expect(loot.food).toBe(Math.floor(10 * 1.5));
  });

  it("currentAct affects crystal yield", () => {
    const act1 = getEndOfRunMaterials(8, 1);
    const act3 = getEndOfRunMaterials(8, 3);
    expect(act3.crystal).toBeGreaterThan(act1.crystal);
  });

  it("all material values are non-negative", () => {
    const loot = getEndOfRunMaterials(5, 2);
    for (const mat of MATERIAL_IDS) {
      expect(loot[mat]).toBeGreaterThanOrEqual(0);
    }
  });
});
