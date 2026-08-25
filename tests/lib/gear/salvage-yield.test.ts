import { describe, expect, it } from "vitest";
import { gearBaseItems, type GearBaseItemId, type GearRarity } from "@/lib/gear";
import { emptyInventory } from "@/lib/homestead/inventory";
import type { MaterialInventory } from "@/lib/homestead/types";

function mats(partial: Partial<MaterialInventory>): MaterialInventory {
  return { ...emptyInventory(), ...partial };
}

const EXPECTED_SALVAGE: Record<GearBaseItemId, Record<GearRarity, MaterialInventory>> = {
  "double-axe": { basic: mats({ iron: 9 }), astral: mats({ iron: 12 }), unique: mats({ iron: 12 }) },
  maul: { basic: mats({ iron: 9 }), astral: mats({ iron: 12 }), unique: mats({ iron: 12 }) },
  greatsword: { basic: mats({ iron: 9 }), astral: mats({ iron: 12 }), unique: mats({ iron: 12 }) },
  hatchet: {
    basic: mats({ iron: 3, wood: 3 }),
    astral: mats({ iron: 6, wood: 3 }),
    unique: mats({ iron: 6, wood: 3 }),
  },
  longsword: { basic: mats({ iron: 6 }), astral: mats({ iron: 9 }), unique: mats({ iron: 9 }) },
  shortsword: { basic: mats({ iron: 3 }), astral: mats({ iron: 6 }), unique: mats({ iron: 6 }) },
  dagger: { basic: mats({ iron: 3 }), astral: mats({ iron: 3, herbs: 3 }), unique: mats({ iron: 3, herbs: 3 }) },
  mace: { basic: mats({ iron: 6 }), astral: mats({ iron: 9 }), unique: mats({ iron: 9 }) },
  flail: { basic: mats({ iron: 6 }), astral: mats({ iron: 9 }), unique: mats({ iron: 9 }) },
  longbow: { basic: mats({ wood: 6 }), astral: mats({ wood: 9 }), unique: mats({ wood: 9 }) },
  shortbow: { basic: mats({ wood: 3 }), astral: mats({ wood: 6 }), unique: mats({ wood: 6 }) },
  "recurve-bow": { basic: mats({ wood: 6 }), astral: mats({ wood: 6, herbs: 3 }), unique: mats({ wood: 6, herbs: 3 }) },
  crossbow: {
    basic: mats({ wood: 6, iron: 3 }),
    astral: mats({ wood: 6, iron: 6 }),
    unique: mats({ wood: 6, iron: 6 }),
  },
  staff: {
    basic: mats({ wood: 3, crystal: 3 }),
    astral: mats({ wood: 6, crystal: 3 }),
    unique: mats({ wood: 6, crystal: 3 }),
  },
  wand: { basic: mats({ wood: 3 }), astral: mats({ wood: 3, crystal: 3 }), unique: mats({ wood: 3, crystal: 3 }) },
  "leather-buckler": { basic: mats({ wood: 3 }), astral: mats({ wood: 6 }), unique: mats({ wood: 6 }) },
  "kite-shield": { basic: mats({ iron: 9 }), astral: mats({ iron: 12 }), unique: mats({ iron: 12 }) },
  quiver: { basic: mats({ wood: 3 }), astral: mats({ wood: 6 }), unique: mats({ wood: 6 }) },
  spellbook: {
    basic: mats({ herbs: 3, crystal: 3 }),
    astral: mats({ herbs: 6, crystal: 3 }),
    unique: mats({ herbs: 6, crystal: 3 }),
  },
  "leather-armor": { basic: mats({ herbs: 6 }), astral: mats({ herbs: 9 }), unique: mats({ herbs: 9 }) },
  "plate-armor": { basic: mats({ iron: 9 }), astral: mats({ iron: 12 }), unique: mats({ iron: 12 }) },
  "ruby-ring": { basic: mats({ crystal: 3 }), astral: mats({ crystal: 6 }), unique: mats({ crystal: 6 }) },
  "sapphire-ring": { basic: mats({ crystal: 3 }), astral: mats({ crystal: 6 }), unique: mats({ crystal: 6 }) },
  "emerald-ring": {
    basic: mats({ crystal: 3 }),
    astral: mats({ crystal: 3, herbs: 3 }),
    unique: mats({ crystal: 3, herbs: 3 }),
  },
  "topaz-ring": { basic: mats({ crystal: 3 }), astral: mats({ crystal: 6 }), unique: mats({ crystal: 6 }) },
  "ruby-amulet": { basic: mats({ crystal: 3 }), astral: mats({ crystal: 6 }), unique: mats({ crystal: 6 }) },
  "sapphire-amulet": { basic: mats({ crystal: 3 }), astral: mats({ crystal: 6 }), unique: mats({ crystal: 6 }) },
  "emerald-amulet": {
    basic: mats({ crystal: 3 }),
    astral: mats({ crystal: 3, herbs: 3 }),
    unique: mats({ crystal: 3, herbs: 3 }),
  },
  "topaz-amulet": { basic: mats({ crystal: 3 }), astral: mats({ crystal: 6 }), unique: mats({ crystal: 6 }) },
};

describe("gear homestead salvage mappings", () => {
  it("matches the thematic salvage table for every base item and rarity", () => {
    for (const [id, expected] of Object.entries(EXPECTED_SALVAGE) as Array<
      [GearBaseItemId, Record<GearRarity, MaterialInventory>]
    >) {
      expect(gearBaseItems[id].salvageByRarity).toEqual(expected);
    }
    expect(Object.keys(EXPECTED_SALVAGE).sort()).toEqual(Object.keys(gearBaseItems).sort());
  });

  it("never yields food", () => {
    for (const item of Object.values(gearBaseItems)) {
      expect(item.salvageByRarity.basic.food).toBe(0);
      expect(item.salvageByRarity.astral.food).toBe(0);
      expect(item.salvageByRarity.unique.food).toBe(0);
    }
  });
});
