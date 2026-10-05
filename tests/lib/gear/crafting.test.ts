import { describe, expect, it, vi } from "vitest";
import {
  applyCraftingCurrency,
  canApplyCraftingCurrency,
  craftingCurrencyBlockedReason,
  computeSalvageYield,
  createEmptyGearLoadouts,
  salvageGear,
  gearAffixCatalog,
  type GearAffixRoll,
  type GearInstance,
} from "@/lib/gear";

function item(affixes: GearAffixRoll[], rarity = "basic"): GearInstance {
  affixes.forEach((affix) => Object.freeze(affix));
  Object.freeze(affixes);
  return Object.freeze({ instanceId: "owned-item", definitionId: `shortsword-${rarity}`, affixes });
}

const physical: GearAffixRoll = { id: "flat-physical", value: 1 };
const maxPhysical: GearAffixRoll = { id: "flat-physical", value: 2 };
const stun: GearAffixRoll = { id: "flat-stun", value: 1 };

describe("crafting currency logic", () => {
  it.each([
    ["discordant-dice", item([]), "This item has no affixes to reroll."],
    ["sprig-of-growth", item([physical, stun]), "No affix slots or eligible affixes available."],
    ["voidstone", item([]), "This item has no affixes to remove."],
    ["ascension-seal", item([physical], "astral"), "Only Basic items can be upgraded to Astral."],
    ["severance-maw", item([]), "This item has no affixes to remove."],
    ["smiths-whetstone", item([]), "This item has no affixes to upgrade."],
    ["smiths-whetstone", item([maxPhysical]), "All affixes are already at maximum."],
  ] as const)("rejects %s consistently in preview and application without drawing", (currency, original, reason) => {
    expect(craftingCurrencyBlockedReason(currency, original)).toBe(reason);
    expect(canApplyCraftingCurrency(currency, original)).toBe(false);
    const rng = vi.fn(() => 0);
    expect(applyCraftingCurrency(currency, original, rng)).toBe(original);
    expect(rng).not.toHaveBeenCalled();
  });

  it("rerolls distinct, eligible affixes while retaining rarity, identity, and slot count", () => {
    const original = item([physical, stun]);
    const updated = applyCraftingCurrency("discordant-dice", original, () => 0);
    expect(updated).toMatchObject({ instanceId: original.instanceId, definitionId: original.definitionId });
    expect(updated.affixes).toHaveLength(2);
    expect(new Set(updated.affixes.map(({ id }) => id)).size).toBe(2);
    for (const roll of updated.affixes) {
      const definition = gearAffixCatalog[roll.id];
      expect(definition.uniqueOnly).toBeFalsy();
      expect(roll.value).toBeGreaterThanOrEqual(definition.roll.basic.min);
      expect(roll.value).toBeLessThanOrEqual(definition.roll.basic.max);
    }
    expect(original.affixes).toEqual([physical, stun]);
  });

  it("adds one new affix while retaining the original roll", () => {
    const original = item([physical]);
    const updated = applyCraftingCurrency("sprig-of-growth", original, () => 0);
    expect(updated.affixes).toHaveLength(2);
    expect(updated.affixes[0]).toEqual(physical);
    expect(updated.affixes[1].id).not.toBe(physical.id);
    expect(updated.affixes[1].value).toBeGreaterThan(0);
    expect(original.affixes).toEqual([physical]);
  });

  it.each([
    ["voidstone", item([physical]), "basic", []],
    ["ascension-seal", item([maxPhysical]), "astral", [{ id: "flat-physical", value: 4 }]],
    ["severance-maw", item([physical, stun], "astral"), "astral", [stun]],
    ["smiths-whetstone", item([maxPhysical, stun]), "basic", [maxPhysical, { id: "flat-stun", value: 2 }]],
  ] as const)(
    "%s changes only the promised values and preserves the owned item",
    (currency, original, rarity, affixes) => {
      const before = structuredClone(original);
      expect(canApplyCraftingCurrency(currency, original)).toBe(true);
      expect(applyCraftingCurrency(currency, original, () => 0)).toEqual({
        ...original,
        definitionId: `shortsword-${rarity}`,
        affixes,
      });
      expect(original).toEqual(before);
    },
  );

  it("rejects missing definitions without consuming RNG", () => {
    const original = { ...item([physical]), definitionId: "unknown-basic" };
    const rng = vi.fn(() => 0);
    for (const currency of ["ascension-seal", "sprig-of-growth"] as const) {
      expect(canApplyCraftingCurrency(currency, original)).toBe(false);
      expect(applyCraftingCurrency(currency, original, rng)).toBe(original);
    }
    expect(rng).not.toHaveBeenCalled();
  });

  it("preserves deterministic salvage payouts across reload and affix changes", () => {
    const original = item([physical]);
    const preview = computeSalvageYield(original);
    expect(computeSalvageYield(JSON.parse(JSON.stringify(original)))).toEqual(preview);
    expect(computeSalvageYield({ ...original, affixes: [maxPhysical] })).toEqual(preview);
    const result = salvageGear([original], createEmptyGearLoadouts(), original.instanceId);
    expect(result?.yieldedCurrencies).toEqual(preview.currencies);
    expect(result?.yieldedMaterials).toEqual(preview.materials);
  });

  it("retains uncataloged affix ids during an upgrade without offering to enhance them", () => {
    const unknown = { id: "non-existent-affix" as GearAffixRoll["id"], value: 5 };
    const original = item([unknown]);
    expect(canApplyCraftingCurrency("smiths-whetstone", original)).toBe(false);
    expect(applyCraftingCurrency("ascension-seal", original, () => 0).affixes).toEqual([unknown]);
  });
});
