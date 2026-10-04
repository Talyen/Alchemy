import { describe, expect, it } from "vitest";
import {
  defaultGearEffects,
  effectsForAffixRolls,
  getGearAffixTooltipEntries,
  normalizeAffixRolls,
  resolveAffixEffects,
} from "@/lib/gear";

describe("gear affixes", () => {
  it("shows both Saintfall magnitudes in its tooltip", () => {
    const [entry] = getGearAffixTooltipEntries([{ id: "saintfall", value: 4 }], "unique");
    expect(entry?.text).toBe("When Block is depleted, deal 4 Holy to the attacker and restore 4 Health");
  });

  it("keeps tooltip keys contiguous after invalid rolls and normalizes displayed values", () => {
    const affixes = Object.freeze([
      Object.freeze({ id: "flat-physical", value: NaN }),
      Object.freeze({ id: "flat-physical", value: 999 }),
      Object.freeze({ id: "flat-physical", value: -1 }),
      Object.freeze({ id: "flat-physical", value: 1.4 }),
    ] as const);
    expect(getGearAffixTooltipEntries(affixes, "basic")).toEqual([
      {
        key: "flat-physical-0",
        affixId: "flat-physical",
        value: 2,
        name: "Ironbound",
        text: "Increases Physical damage by 2",
      },
      {
        key: "flat-physical-1",
        affixId: "flat-physical",
        value: 1,
        name: "Ironbound",
        text: "Increases Physical damage by 1",
      },
    ]);
  });

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
          { id: "flat-stun", value: -1 },
          { id: "flat-stun", value: NaN },
          { id: "flat-stun", value: Infinity },
        ]),
      ).toEqual([{ id: "flat-physical", value: 2 }]);
    });

    it("ignores inherited object keys when restoring rolls and aggregating effects", () => {
      const raw = [
        { id: "constructor", value: 3 },
        { id: "__proto__", value: 3 },
        { id: "toString", value: 3 },
        { id: "flat-physical", value: 2 },
      ];
      expect(normalizeAffixRolls(raw, "basic")).toEqual([{ id: "flat-physical", value: 2 }]);
      expect(effectsForAffixRolls(raw, "basic")).toEqual({ ...defaultGearEffects, flatPhysicalDamage: 2 });
    });
  });

  it("sums repeated affixes without granting unrelated combat bonuses", () => {
    expect(
      resolveAffixEffects([
        { id: "flat-physical", value: 2 },
        { id: "flat-physical", value: 3 },
        { id: "flat-burn", value: 1 },
      ]),
    ).toEqual({ ...defaultGearEffects, flatPhysicalDamage: 5, flatBurnDamage: 1 });
  });

  it("keeps direct aggregation consistent with normalized rolls without changing its inputs", () => {
    const knownAffixes = Object.freeze([
      Object.freeze({ id: "flat-physical", value: 999 }),
      Object.freeze({ id: "flat-physical", value: 0.1 }),
      Object.freeze({ id: "flat-burn", value: 2.4 }),
      Object.freeze({ id: "absorb-per-mana", value: 5 }),
      Object.freeze({ id: "flat-stun", value: -1 }),
      Object.freeze({ id: "flat-stun", value: NaN }),
    ] as const);
    const raw = Object.freeze([...knownAffixes, Object.freeze({ id: "not-an-affix", value: 1 })]);
    for (const rarity of [undefined, "basic", "astral", "unique"] as const) {
      const normalized = normalizeAffixRolls(raw, rarity);
      const expected = resolveAffixEffects(normalized);
      const effects = effectsForAffixRolls(raw, rarity);
      expect(effects).toEqual(expected);
      expect(
        getGearAffixTooltipEntries(knownAffixes, rarity).map(({ affixId, value }) => ({ id: affixId, value })),
      ).toEqual(normalized);
      effects.flatPhysicalDamage = -1;
      expect(effectsForAffixRolls(raw, rarity)).toEqual(expected);
    }
  });
});
