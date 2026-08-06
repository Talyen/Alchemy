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
