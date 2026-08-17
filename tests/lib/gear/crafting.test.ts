import { describe, expect, it } from "vitest";
import {
  applyCraftingCurrency,
  canApplyCraftingCurrency,
  computeSalvageYield,
  createEmptyGearLoadouts,
  normalizeCraftingCurrencies,
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

  it("validates the six currency target rules", () => {
    expect(canApplyCraftingCurrency("discordant-dice", createBasicItem([]))).toBe(false);
    expect(canApplyCraftingCurrency("discordant-dice", createBasicItem([{ id: "flat-physical", value: 1 }]))).toBe(
      true,
    );
    expect(canApplyCraftingCurrency("sprig-of-growth", createBasicItem([{ id: "flat-physical", value: 1 }]))).toBe(
      true,
    );
    expect(
      canApplyCraftingCurrency(
        "sprig-of-growth",
        createBasicItem([
          { id: "flat-physical", value: 1 },
          { id: "flat-stun", value: 1 },
        ]),
      ),
    ).toBe(false);
    expect(canApplyCraftingCurrency("voidstone", createBasicItem())).toBe(true);
    expect(canApplyCraftingCurrency("voidstone", createBasicItem([]))).toBe(false);
    expect(canApplyCraftingCurrency("ascension-seal", createBasicItem())).toBe(true);
    expect(canApplyCraftingCurrency("ascension-seal", createAstralItem())).toBe(false);
    expect(canApplyCraftingCurrency("severance-maw", createBasicItem())).toBe(true);
    expect(canApplyCraftingCurrency("severance-maw", createBasicItem([]))).toBe(false);
    expect(canApplyCraftingCurrency("smiths-whetstone", createBasicItem([{ id: "flat-physical", value: 1 }]))).toBe(
      true,
    );
    expect(canApplyCraftingCurrency("smiths-whetstone", createBasicItem([{ id: "flat-physical", value: 2 }]))).toBe(
      false,
    );
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
    const salvageYield = computeSalvageYield(createBasicItem(), () => 0);
    expect(salvageYield.materials.iron).toBe(3);
    expect(salvageYield.materials.food).toBe(0);
    expect(salvageYield.currencies["discordant-dice"]).toBe(1);
  });

  it("uses a frozen yield instead of re-rolling when salvageGear is given one", () => {
    const item = createBasicItem();
    const frozen = computeSalvageYield(item, () => 0.99);
    const result = salvageGear([item], createEmptyGearLoadouts(), item.instanceId, () => 0, frozen);
    expect(result?.yieldedCurrencies).toEqual(frozen.currencies);
    expect(result?.yieldedMaterials).toEqual(frozen.materials);
  });

  it("normalizes crafting currencies to known nonnegative integer ids", () => {
    expect(
      normalizeCraftingCurrencies({
        "discordant-dice": 2.8,
        "sprig-of-growth": -1,
        voidstone: Number.POSITIVE_INFINITY,
        unknown: 10,
      }),
    ).toEqual({
      "discordant-dice": 2,
      "sprig-of-growth": 0,
      voidstone: 0,
      "ascension-seal": 0,
      "severance-maw": 0,
      "smiths-whetstone": 0,
    });
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
