import { resolveLootWeights } from "@/lib/loot";
import { describe, expect, it, vi } from "vitest";
import {
  canApplyCraftingCurrency,
  applyCraftingCurrency,
  craftingCurrencyBlockedReason,
  CRAFTING_CURRENCY_LIST,
  generateLootGearChoices,
  generateUniqueGearInstance,
  gearAffixCatalog,
  getGearInstanceAffixes,
  normalizeGearInstance,
  effectsForInstance,
  getGearInstanceTooltipEntries,
  gearDefinitions,
  getGearInstanceTitle,
  rollSalvageYield,
  uniqueItemList,
  type GearAffixId,
  type GearInstance,
} from "@/lib/gear";
import { UNIQUE_GEAR_COMBAT } from "@/lib/game-constants";

describe("unique item catalog", () => {
  it("prevents crafting currencies from modifying unique items", () => {
    const unique = uniqueItemList[0];
    const instance = generateUniqueGearInstance(unique);
    const rng = vi.fn(() => 0);
    for (const { id } of CRAFTING_CURRENCY_LIST) {
      expect(craftingCurrencyBlockedReason(id, instance)).toBe("Unique items cannot be crafted.");
      expect(canApplyCraftingCurrency(id, instance)).toBe(false);
      expect(applyCraftingCurrency(id, instance, rng)).toBe(instance);
    }
    expect(rng).not.toHaveBeenCalled();
  });

  it("yields guaranteed salvage currency package on unique salvage", () => {
    const rng = vi.fn(() => 0.5);
    expect(rollSalvageYield("unique", rng)).toEqual({
      "discordant-dice": 2,
      "ascension-seal": 1,
      "severance-maw": 1,
      "smiths-whetstone": 1,
      "sprig-of-growth": 0,
      voidstone: 0,
    });
    expect(rng).not.toHaveBeenCalled();
  });

  it("excludes owned uniques from equipment shop offerings and degrades when all owned", () => {
    const allOwnedIds = new Set(uniqueItemList.map((u) => u.id));
    const offerings = generateLootGearChoices(
      3,
      () => 0.99,
      resolveLootWeights({ source: "equipment", progress: { depth: 24, highestCompletedDifficulty: null } }),
      allOwnedIds,
    );
    expect(offerings).toHaveLength(3);

    for (const offering of offerings) {
      expect(gearDefinitions[offering.definitionId]?.rarity).toBe("astral");
    }
  });
});

it("repairs malformed rolls consistently for saved gear, combat effects, and tooltips", () => {
  const raw = {
    instanceId: "damaged-save-item",
    definitionId: "longsword-basic",
    affixes: [
      null,
      4,
      { id: { toString: () => "flat-physical" }, value: 3 },
      { id: "flat-physical", value: "4" },
      { id: "flat-physical", value: 999 },
    ],
  };
  const normalized = normalizeGearInstance(raw)!;
  const expected = gearAffixCatalog["flat-physical"].roll.basic.max;
  expect(normalized).toEqual({
    instanceId: raw.instanceId,
    definitionId: raw.definitionId,
    affixes: [{ id: "flat-physical", value: expected }],
  });
  const live = raw as unknown as GearInstance;
  expect(effectsForInstance(live)).toEqual(effectsForInstance(normalized));
  expect(getGearInstanceTooltipEntries(live)).toEqual(getGearInstanceTooltipEntries(normalized));
});

describe("fixed Unique compatibility", () => {
  it.each(uniqueItemList)("repairs saved $displayName without changing ownership", (unique) => {
    expect(getGearInstanceTitle(generateUniqueGearInstance(unique))).toBe(unique.displayName);
    const original: GearInstance = {
      instanceId: "owned-id",
      definitionId: unique.id,
      affixes: [{ id: "flat-physical", value: 99 }],
    };
    const expected = [unique.signatureAffix, ...unique.supportingAffixes];
    const normalized = normalizeGearInstance(original)!;
    // Divergent stored rolls are dropped; reads resolve the canonical affixes.
    expect(normalized).toEqual({ ...original, affixes: [] });
    expect(getGearInstanceAffixes(normalized)).toEqual(expected);
    expect(normalizeGearInstance(normalized)).toEqual(normalized);
    expect(effectsForInstance(original)).toEqual(effectsForInstance(normalized));
    expect(getGearInstanceTooltipEntries(original)).toEqual(getGearInstanceTooltipEntries(normalized));
  });

  it("shows Solstice for an existing staff without changing its saved identity or Twincasting signature", () => {
    const saved: GearInstance = { instanceId: "owned-staff", definitionId: "twin-casting", affixes: [] };
    const restored = normalizeGearInstance(saved)!;

    expect(restored).toEqual(saved);
    expect(getGearInstanceTitle(restored)).toBe("Solstice");
    expect(getGearInstanceTooltipEntries(restored)[0]).toMatchObject({
      affixId: "twin-casting",
      name: "Twincasting",
      text: "Playing a Burn card draws a Freeze card, and vice versa",
    });
    expect(effectsForInstance(restored).elementalTwinCasting).toBe(1);
  });

  it("keeps UNIQUE_GEAR_COMBAT magnitudes in sync with signature descriptions", () => {
    const descriptionOf = (id: GearAffixId) => gearAffixCatalog[id].descriptionTemplate;
    // Numeric prose: the number in text must equal the combat constant.
    expect(descriptionOf("wrenflight")).toContain(`${UNIQUE_GEAR_COMBAT.wrenflightDodgeChancePercent}% Dodge`);
    expect(descriptionOf("winters-credit")).toContain(
      `Spend ${UNIQUE_GEAR_COMBAT.winterBlockPerMana} Block per missing Mana`,
    );
    expect(descriptionOf("the-returning-flight")).toContain(
      `costs ${UNIQUE_GEAR_COMBAT.returnedCardDiscount} less Mana`,
    );
  });
});
