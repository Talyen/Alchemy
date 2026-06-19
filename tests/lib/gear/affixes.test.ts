import { describe, expect, it } from "vitest";
import { gearAffixCatalog } from "@/lib/gear/affix-catalog";
import { GEAR_AFFIX_IDS } from "@/lib/gear/affix-ids";
import { defaultGearEffects, normalizeAffixRolls, resolveAffixEffects } from "@/lib/gear";

describe("gear affixes", () => {
  describe("normalizeAffixRolls", () => {
    it("prefers affix rolls over legacy modifiers", () => {
      expect(
        normalizeAffixRolls({
          affixes: [{ id: "flat-burn", value: 2 }],
          modifiers: [{ kind: "flatPhysicalDamage", value: 5 }],
        }),
      ).toEqual([{ id: "flat-burn", value: 2 }]);
    });

    it("migrates legacy affix ids to rolls", () => {
      expect(normalizeAffixRolls({ affixIds: ["flat-physical-1", "flat-stun-1"] })).toEqual([
        { id: "flat-physical", value: 1 },
        { id: "flat-stun", value: 1 },
      ]);
    });

    it("strips invalid and non-positive roll values", () => {
      expect(
        normalizeAffixRolls({
          affixes: [
            { id: "flat-physical", value: 2 },
            { id: "not-an-affix", value: 1 },
            { id: "flat-stun", value: 0 },
          ],
        }),
      ).toEqual([{ id: "flat-physical", value: 2 }]);
    });

    it("converts legacy physical modifiers when affix rolls are absent", () => {
      expect(normalizeAffixRolls({ modifiers: [{ kind: "flatPhysicalDamage", value: 2 }] })).toEqual([
        { id: "flat-physical", value: 1 },
        { id: "flat-physical", value: 1 },
      ]);
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
