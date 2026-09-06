import { describe, expect, it } from "vitest";
import { GEAR_AFFIX_IDS, gearAffixCatalog } from "@/lib/gear/affix-catalog";
import { defaultGearEffects, normalizeAffixRolls, resolveAffixEffects } from "@/lib/gear";

describe("gear affixes", () => {
  describe("normalizeAffixRolls", () => {
    it("validates and rounds canonical affix rolls", () => {
      expect(
        normalizeAffixRolls([
          { id: "flat-burn", value: 2.4 },
          { id: "flat-physical", value: 5 },
        ]),
      ).toEqual([
        { id: "flat-burn", value: 2 },
        { id: "flat-physical", value: 5 },
      ]);
    });

    it("strips invalid and non-positive roll values", () => {
      expect(
        normalizeAffixRolls([
          { id: "flat-physical", value: 2 },
          { id: "not-an-affix", value: 1 },
          { id: "flat-stun", value: 0 },
        ]),
      ).toEqual([{ id: "flat-physical", value: 2 }]);
    });
  });

  describe("resolveAffixEffects", () => {
    it.each(GEAR_AFFIX_IDS)("maps %s to its catalog effect key", (affixId) => {
      const definition = gearAffixCatalog[affixId];
      const effects = resolveAffixEffects([{ id: affixId, value: 3 }]);
      expect(effects[definition.effectKey]).toBe(defaultGearEffects[definition.effectKey] + 3);
    });
  });
});

describe("rebalanced saved affixes", () => {
  it.each(["basic", "astral", "unique"] as const)("normalizes Lifegiving to 1 for %s gear", (rarity) => {
    const normalized = normalizeAffixRolls([{ id: "health-per-turn", value: 4 }], rarity);
    expect(normalized).toEqual([{ id: "health-per-turn", value: 1 }]);
    expect(normalizeAffixRolls(normalized, rarity)).toEqual(normalized);
  });
  it.each([
    ["basic", 1],
    ["astral", 2],
  ] as const)("normalizes Emberforged for %s gear", (rarity, value) => {
    expect(normalizeAffixRolls([{ id: "forge-on-burn", value: 4 }], rarity)).toEqual([{ id: "forge-on-burn", value }]);
  });
});
