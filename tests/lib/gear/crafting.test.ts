import { describe, expect, it } from "vitest";
import {
  applyCraftingCurrency,
  canApplyCraftingCurrency,
  normalizeCraftingCurrencies,
  rollSalvageYield,
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
    expect(canApplyCraftingCurrency("discordant-dice", createBasicItem([]))).toBe(true);
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

  it("removes all affixes with Voidstone", () => {
    const updated = applyCraftingCurrency("voidstone", createBasicItem([{ id: "flat-physical", value: 1 }]));
    expect(updated.affixes).toEqual([]);
  });

  it("upgrades basic gear and existing affix values to astral quality", () => {
    const updated = applyCraftingCurrency("ascension-seal", createBasicItem([{ id: "flat-physical", value: 2 }]));
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
});
