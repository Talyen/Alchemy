import { installCatalogs, localization } from "@/lib/localization/runtime";
import catalogs from "@/lib/localization/locales/runtime.json";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_ARMORY_INVENTORY_FILTERS,
  createArmoryInventoryMatcher,
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

let matcher = createArmoryInventoryMatcher();
const matchesGearFilters = (item: GearInstance, criteria: ArmoryInventoryFilters) =>
  matcher.matchesGearFilters(item, criteria);
const matchesTrinketFilters = (item: TrinketEntry, criteria: ArmoryInventoryFilters) =>
  matcher.matchesTrinketFilters(item, criteria);
beforeEach(() => {
  matcher = createArmoryInventoryMatcher();
});
afterEach(() => vi.restoreAllMocks());

describe("Armory inventory matching", () => {
  it("reuses search text across queries and rebuilds it for changed item references", () => {
    const translate = vi.fn<(value: unknown) => void>();
    const cached = createArmoryInventoryMatcher(<T>(value: T): T => {
      translate(value);
      return value;
    });
    expect(cached.matchesGearFilters(sword, filters({ search: "longsword" }))).toBe(true);
    const calls = translate.mock.calls.length;
    expect(cached.matchesGearFilters(sword, filters({ search: "poison" }))).toBe(true);
    expect(translate.mock.calls).toHaveLength(calls);
    expect(cached.matchesGearFilters({ ...sword, affixes: [] }, filters({ search: "poison" }))).toBe(false);
    expect(translate.mock.calls.length).toBeGreaterThan(calls);
  });

  it("accepts localized item names and effects while retaining English searches", async () => {
    installCatalogs(catalogs);
    await localization.changeLanguage("de");
    try {
      expect(matchesGearFilters(sword, filters({ search: "langschwert physisch" }))).toBe(true);
      expect(matchesGearFilters(sword, filters({ search: "longsword physical" }))).toBe(true);
    } finally {
      await localization.changeLanguage("en");
    }
  });

  it("finds item names when a player types a straight apostrophe for an authored curly apostrophe", () => {
    const unique: GearInstance = { instanceId: "viper", definitionId: "vipers-courtesy", affixes: [] };
    expect(matchesGearFilters(unique, filters({ search: "viper's courtesy" }))).toBe(true);
  });

  it("matches English item names regardless of the host's Turkish case rules", () => {
    const lower = String.prototype.toLocaleLowerCase;
    vi.spyOn(String.prototype, "toLocaleLowerCase").mockImplementation(function (this: string, locales) {
      return lower.call(this, locales ?? "tr");
    });
    const trinket: TrinketEntry = {
      id: "charm",
      title: "Icy Charm",
      art: "",
      descriptionLines: ["Gain Block after Freeze."],
      effects: {},
    };
    expect(matchesTrinketFilters(trinket, filters({ search: "icy" }))).toBe(true);
    expect(matchesTrinketFilters(trinket, filters({ search: "ICY" }))).toBe(true);
  });

  it("combines normalized search words, rarity, and keywords", () => {
    const criteria = filters({
      search: "  PHYSICAL   longsword ",
      rarities: ["basic", "astral"],
      keywords: ["physical"],
    });
    expect(matchesGearFilters(sword, criteria)).toBe(true);
    expect(matchesGearFilters(sword, { ...criteria, rarities: ["unique"] })).toBe(false);
    expect(matchesGearFilters(sword, { ...criteria, search: "longsword burn" })).toBe(false);
  });

  it("matches any selected affix keyword without counting base affinities", () => {
    expect(matchesGearFilters(sword, filters({ keywords: ["physical", "burn"] }))).toBe(true);
    expect(matchesGearFilters(sword, filters({ keywords: ["burn", "freeze"] }))).toBe(false);
    expect(matchesGearFilters(sword, filters({ keywords: ["physical", "poison"] }))).toBe(true);
    expect(matchesGearFilters({ ...sword, affixes: [] }, filters({ keywords: ["physical"] }))).toBe(false);
  });

  it("searches Unique names, base names, and canonical fixed affixes", () => {
    const unique: GearInstance = { instanceId: "unique", definitionId: "oathkeeper", affixes: [] };
    expect(matchesGearFilters(unique, filters({ search: "oathkeeper longsword" }))).toBe(true);
    const keywords = getGearInstanceKeywordIds(unique);
    expect(keywords.length).toBeGreaterThan(0);
    expect(matchesGearFilters(unique, filters({ keywords }))).toBe(true);
    expect(matchesGearFilters(unique, filters({ search: "physical" }))).toBe(true);
  });

  it("filters Trinket effect keywords without applying Gear rarity", () => {
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
      rarities: ["unique"],
    });
    expect(matchesTrinketFilters(trinket, criteria)).toBe(true);
    expect(matchesTrinketFilters(trinket, { ...criteria, keywords: ["freeze", "physical"] })).toBe(true);
    expect(matchesTrinketFilters(trinket, { ...criteria, keywords: ["physical"] })).toBe(false);
  });
});
