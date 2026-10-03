import { describe, expect, it, vi } from "vitest";
import {
  applyCraftingCurrency,
  canApplyCraftingCurrency,
  craftingCurrencyBlockedReason,
  computeSalvageYield,
  createEmptyGearLoadouts,
  rollSalvageYield,
  salvageGear,
  type GearAffixRoll,
  type GearInstance,
} from "@/lib/gear";

describe("crafting currency logic", () => {
  const createBasicItem = (affixes: GearAffixRoll[] = [{ id: "flat-physical", value: 1 }]): GearInstance => ({
    instanceId: "test-basic-id",
    definitionId: "shortsword-basic",
    affixes,
  });

  const createAstralItem = (
    affixes: GearAffixRoll[] = [
      { id: "flat-physical", value: 3 },
      { id: "physical-bleed-chance", value: 9 },
      { id: "flat-stun", value: 3 },
    ],
  ): GearInstance => ({
    instanceId: "test-astral-id",
    definitionId: "shortsword-astral",
    affixes,
  });

  it.each([
    ["discordant-dice", createBasicItem([]), "This item has no affixes to reroll."],
    ["discordant-dice", createBasicItem(), null],
    ["sprig-of-growth", createBasicItem(), null],
    [
      "sprig-of-growth",
      createBasicItem([
        { id: "flat-physical", value: 1 },
        { id: "flat-stun", value: 1 },
      ]),
      "No affix slots or eligible affixes available.",
    ],
    ["voidstone", createBasicItem(), null],
    ["voidstone", createBasicItem([]), "This item has no affixes to remove."],
    ["ascension-seal", createBasicItem(), null],
    ["ascension-seal", createAstralItem(), "Only Basic items can be upgraded to Astral."],
    ["severance-maw", createBasicItem(), null],
    ["severance-maw", createBasicItem([]), "This item has no affixes to remove."],
    ["smiths-whetstone", createBasicItem(), null],
    ["smiths-whetstone", createBasicItem([]), "This item has no affixes to upgrade."],
    ["smiths-whetstone", createBasicItem([{ id: "flat-physical", value: 2 }]), "All affixes are already at maximum."],
  ] as const)("keeps %s eligibility, rejection and application consistent", (currency, item, reason) => {
    const original = structuredClone(item);
    expect(craftingCurrencyBlockedReason(currency, item)).toBe(reason);
    expect(canApplyCraftingCurrency(currency, item)).toBe(reason === null);
    if (reason !== null) {
      const rng = vi.fn(() => 0);
      expect(applyCraftingCurrency(currency, item, rng)).toBe(item);
      expect(rng).not.toHaveBeenCalled();
    }
    expect(item).toEqual(original);
  });

  it("rerolls all affixes using an affinity-eligible pool", () => {
    const updated = applyCraftingCurrency("discordant-dice", createBasicItem(), () => 0);
    expect(updated.definitionId).toBe("shortsword-basic");
    expect(updated.affixes).toHaveLength(1);
    expect(updated.affixes[0].value).toBeGreaterThan(0);
  });

  it("preserves current affix count when rerolling with Discordant Dice", () => {
    const basic = applyCraftingCurrency(
      "discordant-dice",
      createBasicItem([
        { id: "flat-physical", value: 1 },
        { id: "flat-stun", value: 1 },
      ]),
      () => 0,
    );
    const astral = applyCraftingCurrency("discordant-dice", createAstralItem(), () => 0);

    expect(basic.affixes).toHaveLength(2);
    expect(astral.affixes).toHaveLength(3);
  });

  it("requires a real astral target definition for Ascension Seal", () => {
    expect(
      canApplyCraftingCurrency("ascension-seal", {
        instanceId: "custom-basic",
        definitionId: "not-a-real-basic",
        affixes: [],
      }),
    ).toBe(false);
  });

  it("adds a random affix without exceeding rarity capacity", () => {
    const updated = applyCraftingCurrency(
      "sprig-of-growth",
      createBasicItem([{ id: "flat-physical", value: 1 }]),
      () => 0,
    );
    expect(updated.affixes).toHaveLength(2);
    expect(updated.affixes[0].id).toBe("flat-physical");
    expect(updated.affixes[1].id).toBeDefined();
  });

  it("does not allow Sprig of Growth when the eligible affix pool is exhausted", () => {
    const item: GearInstance = {
      instanceId: "exhausted-pool",
      definitionId: "unknown-basic",
      affixes: [{ id: "flat-physical", value: 1 }],
    };

    expect(canApplyCraftingCurrency("sprig-of-growth", item)).toBe(false);
    expect(applyCraftingCurrency("sprig-of-growth", item, () => 0)).toBe(item);
  });

  it("removes all affixes with Voidstone", () => {
    const updated = applyCraftingCurrency("voidstone", createBasicItem([{ id: "flat-physical", value: 1 }]), () => 0.5);
    expect(updated.affixes).toEqual([]);
  });

  it("upgrades basic gear and existing affix values to astral quality", () => {
    const updated = applyCraftingCurrency(
      "ascension-seal",
      createBasicItem([{ id: "flat-physical", value: 2 }]),
      () => 0.5,
    );
    expect(updated.definitionId).toBe("shortsword-astral");
    expect(updated.affixes).toEqual([{ id: "flat-physical", value: 4 }]);
  });

  it("removes a random affix without changing item quality", () => {
    const updated = applyCraftingCurrency(
      "severance-maw",
      createAstralItem([
        { id: "flat-physical", value: 3 },
        { id: "flat-stun", value: 3 },
      ]),
      () => 0,
    );
    expect(updated.definitionId).toBe("shortsword-astral");
    expect(updated.affixes).toEqual([{ id: "flat-stun", value: 3 }]);
  });

  it("increments a random non-maxed affix value by 1", () => {
    const updated = applyCraftingCurrency(
      "smiths-whetstone",
      createBasicItem([
        { id: "flat-physical", value: 2 },
        { id: "flat-stun", value: 1 },
      ]),
      () => 0,
    );
    expect(updated.affixes).toEqual([
      { id: "flat-physical", value: 2 },
      { id: "flat-stun", value: 2 },
    ]);
  });

  it("yields current currencies from salvage", () => {
    expect(rollSalvageYield("basic", () => 0)["discordant-dice"]).toBeGreaterThanOrEqual(1);
    const astralYield = rollSalvageYield("astral", () => 0);
    expect(astralYield["discordant-dice"]).toBeGreaterThanOrEqual(1);
    expect(astralYield["smiths-whetstone"]).toBe(1);
  });

  it("combines homestead salvage value with rolled crafting currencies", () => {
    const salvageYield = computeSalvageYield(createBasicItem());
    expect(salvageYield.materials.iron).toBe(3);
    expect(salvageYield.materials.food).toBe(0);
    expect(salvageYield.currencies["discordant-dice"]).toBeGreaterThanOrEqual(1);
  });

  it("uses a frozen yield instead of re-rolling when salvageGear is given one", () => {
    const item = createBasicItem();
    const frozen = computeSalvageYield(item);
    const result = salvageGear([item], createEmptyGearLoadouts(), item.instanceId, frozen);
    expect(result?.yieldedCurrencies).toEqual(frozen.currencies);
    expect(result?.yieldedMaterials).toEqual(frozen.materials);
  });

  it("keeps salvage preview rewards stable across reload and affix changes", () => {
    const item = createBasicItem();
    const preview = computeSalvageYield(item);
    const reloaded = JSON.parse(JSON.stringify(item)) as GearInstance;
    expect(computeSalvageYield(reloaded)).toEqual(preview);
    expect(computeSalvageYield({ ...item, affixes: [{ id: "flat-physical", value: 2 }] })).toEqual(preview);
  });

  it("handles uncataloged affix ids safely without throwing", () => {
    const unknownItem: GearInstance = {
      instanceId: "test-unknown-id",
      definitionId: "shortsword-basic",
      affixes: [{ id: "non-existent-affix" as any, value: 5 }],
    };
    expect(canApplyCraftingCurrency("smiths-whetstone", unknownItem)).toBe(false);
    expect(canApplyCraftingCurrency("ascension-seal", unknownItem)).toBe(true);
    const upgraded = applyCraftingCurrency("ascension-seal", unknownItem, () => 0);
    expect(upgraded.affixes[0].id).toBe("non-existent-affix");
  });
});
