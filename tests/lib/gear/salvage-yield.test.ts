import { describe, expect, it } from "vitest";
import { gearBaseItemList, gearBaseItems, type GearBaseItemId, type GearRarity } from "@/lib/gear";
import { MATERIAL_IDS, type MaterialId } from "@/lib/homestead/types";
import { emptyInventory } from "@/lib/homestead/inventory";
import type { MaterialInventory } from "@/lib/homestead/types";

function mats(partial: Partial<MaterialInventory>): MaterialInventory {
  return { ...emptyInventory(), ...partial };
}

// Golden rows pin the shape of representative yields; the property checks
// below cover the whole table so rebalances don't require dual edits.
const GOLDEN_SALVAGE: Partial<Record<GearBaseItemId, Record<GearRarity, MaterialInventory>>> = {
  "double-axe": { basic: mats({ iron: 9 }), astral: mats({ iron: 12 }), unique: mats({ iron: 12 }) },
  staff: {
    basic: mats({ wood: 3, crystal: 3 }),
    astral: mats({ wood: 6, crystal: 3 }),
    unique: mats({ wood: 6, crystal: 3 }),
  },
  quiver: { basic: mats({ hide: 3 }), astral: mats({ hide: 6 }), unique: mats({ hide: 6 }) },
  "leather-armor": { basic: mats({ hide: 3 }), astral: mats({ hide: 6 }), unique: mats({ hide: 6 }) },
  "leather-buckler": {
    basic: mats({ wood: 3, hide: 3 }),
    astral: mats({ wood: 6, hide: 6 }),
    unique: mats({ wood: 6, hide: 6 }),
  },
};

describe("gear homestead salvage mappings", () => {
  it("covers every base item with a salvage row", () => {
    expect(Object.keys(gearBaseItems).sort()).toEqual(gearBaseItemList.map((base) => base.id).sort());
    for (const item of Object.values(gearBaseItems)) {
      for (const rarity of ["basic", "astral", "unique"] as const) {
        expect(item.salvageByRarity[rarity]).toBeDefined();
      }
    }
  });

  it("matches the golden rows for representative yields", () => {
    for (const [id, expected] of Object.entries(GOLDEN_SALVAGE) as Array<
      [GearBaseItemId, Record<GearRarity, MaterialInventory>]
    >) {
      expect(gearBaseItems[id].salvageByRarity).toEqual(expected);
    }
  });

  it("never yields food and never decreases a material from basic to astral", () => {
    for (const item of Object.values(gearBaseItems)) {
      for (const material of MATERIAL_IDS as readonly MaterialId[]) {
        expect(item.salvageByRarity.basic[material]).toBeGreaterThanOrEqual(0);
        expect(item.salvageByRarity.astral[material]).toBeGreaterThanOrEqual(item.salvageByRarity.basic[material]);
      }
      expect(item.salvageByRarity.basic.food).toBe(0);
      expect(item.salvageByRarity.astral.food).toBe(0);
      expect(item.salvageByRarity.unique.food).toBe(0);
    }
  });

  it("gives leather goods a hide yield instead of currencies-only salvage", () => {
    for (const id of ["quiver", "leather-armor", "leather-buckler"] as const) {
      expect(gearBaseItems[id].salvageByRarity.basic.hide).toBeGreaterThan(0);
    }
  });
});
