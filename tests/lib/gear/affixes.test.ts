import { describe, expect, it } from "vitest";
import { defaultGearEffects, effectsForAffixRolls, getGearAffixTooltipEntries, normalizeAffixRolls } from "@/lib/gear";
import { gearAffixCatalog } from "@/lib/gear/affix-catalog";
import { rollAffixValue } from "@/lib/gear/affixes";
import { getUniqueAffixes } from "@/lib/gear/unique-catalog";

describe("gear affixes", () => {
  it.each([
    ["flat-burn", "flatBurnDamage", 1, 2, 2, 3, 3, 4, "bloodfire-signet"],
    ["flat-poison", "flatPoisonDamage", 1, 2, 2, 3, 3, 4, "blackfletch"],
    ["flat-bleed", "flatBleedDamage", 1, 2, 2, 3, 3, 4, "blackfletch"],
    ["flat-nature", "flatNatureDamage", 1, 2, 2, 3, 3, 4, "huntsmasters-call"],
    ["archery-damage", "flatArrowDamage", 2, 3, 3, 4, 4, 5, "blackfletch"],
    ["burn-per-mana", "burnDamagePerManaPercent", 5, 8, 8, 10, 8, 12, "twin-casting"],
  ] as const)(
    "keeps %s Astral rolls within their tuned range without changing Basic or Unique rolls",
    (id, effectKey, basicMin, basicMax, astralMin, astralMax, uniqueMin, uniqueMax, uniqueId) => {
      const affix = gearAffixCatalog[id];
      expect(affix.roll.basic).toEqual({ min: basicMin, max: basicMax });
      expect(affix.roll.astral).toEqual({ min: astralMin, max: astralMax });
      expect(affix.roll.unique).toEqual({ min: uniqueMin, max: uniqueMax });
      expect(rollAffixValue(affix, "astral", () => 0)).toBe(astralMin);
      expect(rollAffixValue(affix, "astral", () => 0.999)).toBe(astralMax);

      const oldRoll = [{ id, value: uniqueMax }];
      expect(normalizeAffixRolls(oldRoll, "astral")).toEqual([{ id, value: astralMax }]);
      expect(effectsForAffixRolls(oldRoll, "astral")[effectKey]).toBe(astralMax);
      expect(getGearAffixTooltipEntries(oldRoll, "astral")[0]?.value).toBe(astralMax);
      expect(getUniqueAffixes(uniqueId)).toContainEqual({ id, value: uniqueMax });
      expect(effectsForAffixRolls(oldRoll, "unique")[effectKey]).toBe(uniqueMax);
    },
  );

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

  it("owns every chance list even when no affix has populated it", () => {
    const empty = effectsForAffixRolls([]);
    const populated = effectsForAffixRolls([{ id: "forge-on-stun", value: 25 }]);
    const before = structuredClone(populated);
    for (const key of [
      "forgeOnStunChances",
      "forgeOnBurnVsUnburnedChances",
      "forgeOnConsumeBurnCardChances",
      "forgeOnCompanionDamageVsBurningChances",
    ] as const)
      empty[key].push(100);
    expect(populated).toEqual(before);
    expect(effectsForAffixRolls([])).toEqual(defaultGearEffects);
    expect(Object.values(defaultGearEffects).filter(Array.isArray).flat()).toEqual([]);
  });

  describe("normalizeAffixRolls", () => {
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
      effectsForAffixRolls([
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
      Object.freeze({ id: "flat-stun", value: Infinity }),
      Object.freeze({ id: "flat-stun", value: 0 }),
    ] as const);
    const raw = Object.freeze([...knownAffixes, Object.freeze({ id: "not-an-affix", value: 1 })]);
    for (const [rarity, flatPhysicalDamage, flatBurnDamage, damageReductionPerMana] of [
      [undefined, 999, 2, 5],
      ["basic", 3, 2, 1],
      ["astral", 7, 2, 1],
      ["unique", 7, 3, 1],
    ] as const) {
      const normalized = normalizeAffixRolls(raw, rarity);
      const expected = { ...defaultGearEffects, flatPhysicalDamage, flatBurnDamage, damageReductionPerMana };
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
