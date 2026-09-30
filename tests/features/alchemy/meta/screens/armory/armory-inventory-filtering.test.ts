import { describe, expect, it } from "vitest";
import {
  DEFAULT_ARMORY_INVENTORY_FILTERS,
  matchesGearFilters,
  matchesTrinketFilters,
  type ArmoryInventoryFilters,
} from "@/features/alchemy/meta/screens/armory/armory-inventory-filtering";
import { getGearInstanceKeywordIds, type GearInstance } from "@/lib/gear";
import type { TrinketEntry } from "@/lib/game-data";

const sword: GearInstance = {
  instanceId: "sword",
  definitionId: "longsword-astral",
  affixes: [
    { id: "flat-physical", value: 2 },
    { id: "flat-poison", value: 2 },
  ],
};
const filters = (patch: Partial<ArmoryInventoryFilters>): ArmoryInventoryFilters => ({
  ...DEFAULT_ARMORY_INVENTORY_FILTERS,
  ...patch,
});
const equipped = new Set(["sword"]);

describe("Armory inventory matching", () => {
  it("combines normalized search words, rarity, keywords, and equipment", () => {
    const criteria = filters({
      search: "  PHYSICAL   longsword ",
      rarities: ["basic", "astral"],
      keywords: ["physical"],
      equipment: "equipped",
    });
    expect(matchesGearFilters(sword, criteria, equipped)).toBe(true);
    expect(matchesGearFilters(sword, { ...criteria, rarities: ["unique"] }, equipped)).toBe(false);
    expect(matchesGearFilters(sword, criteria, new Set())).toBe(false);
    expect(matchesGearFilters(sword, { ...criteria, search: "longsword burn" }, equipped)).toBe(false);
  });

  it("keeps the current hero's other equipped slot out of both equipment subsets", () => {
    expect(matchesGearFilters(sword, filters({ equipment: "equipped" }), equipped, new Set())).toBe(false);
    expect(matchesGearFilters(sword, filters({ equipment: "unequipped" }), equipped, new Set())).toBe(false);
    expect(matchesGearFilters(sword, filters({ equipment: null }), equipped, new Set())).toBe(true);
  });

  it("matches Any or All across affixes without counting base affinities", () => {
    expect(matchesGearFilters(sword, filters({ keywords: ["physical", "burn"] }), equipped)).toBe(true);
    expect(matchesGearFilters(sword, filters({ keywords: ["physical", "burn"], keywordMatch: "all" }), equipped)).toBe(
      false,
    );
    expect(
      matchesGearFilters(sword, filters({ keywords: ["physical", "poison"], keywordMatch: "all" }), equipped),
    ).toBe(true);
    expect(matchesGearFilters({ ...sword, affixes: [] }, filters({ keywords: ["physical"] }), equipped)).toBe(false);
  });

  it("searches Unique names, base names, and canonical fixed affixes", () => {
    const unique: GearInstance = { instanceId: "unique", definitionId: "oathkeeper", affixes: [] };
    expect(matchesGearFilters(unique, filters({ search: "oathkeeper longsword" }), new Set())).toBe(true);
    const keywords = getGearInstanceKeywordIds(unique);
    expect(keywords.length).toBeGreaterThan(0);
    expect(matchesGearFilters(unique, filters({ keywords, keywordMatch: "all" }), new Set())).toBe(true);
    expect(matchesGearFilters(unique, filters({ search: "physical" }), new Set())).toBe(true);
  });

  it("filters Trinket effect keywords and equipment without applying Gear rarity", () => {
    const trinket: TrinketEntry = {
      id: "charm",
      title: "Cold Charm",
      art: "",
      descriptionLines: ["Gain Block after Freeze."],
      effects: {},
    };
    const criteria = filters({
      search: "freeze charm",
      keywords: ["block", "freeze"],
      keywordMatch: "all",
      rarities: ["unique"],
      equipment: "unequipped",
    });
    expect(matchesTrinketFilters(trinket, criteria, new Set())).toBe(true);
    expect(matchesTrinketFilters(trinket, criteria, new Set(["charm"]))).toBe(false);
    expect(matchesTrinketFilters(trinket, { ...criteria, keywords: ["physical"] }, new Set())).toBe(false);
  });
});
