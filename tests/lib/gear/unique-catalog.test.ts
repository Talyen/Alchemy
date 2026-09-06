import { describe, expect, it } from "vitest";
import {
  canApplyCraftingCurrency,
  generateEquipmentShopOfferings,
  generateUniqueGearInstance,
  gearAffixCatalog,
  gearBaseItemList,
  normalizeGearInstance,
  effectsForInstance,
  getGearInstanceTooltipEntries,
  gearDefinitions,
  getGearInstanceTitle,
  rollSalvageYield,
  uniqueItemList,
  type GearInstance,
} from "@/lib/gear";
import { EQUIPMENT_SHOP_UNIQUE_PRICE } from "@/lib/game-constants";
import { getEquipmentShopPrice } from "@/features/alchemy/run-loop/shop/shop-pricing";

describe("unique item catalog", () => {
  it("covers every base item exactly once with four fixed maximum affixes", () => {
    expect(uniqueItemList).toHaveLength(29);
    expect(uniqueItemList.map((item) => item.baseItemId).sort()).toEqual(
      gearBaseItemList.map((base) => base.id).sort(),
    );
    expect(new Set(uniqueItemList.map((item) => item.signatureAffix.id)).size).toBe(29);
    for (const unique of uniqueItemList) {
      expect(unique.signatureAffix).toBeDefined();
      expect(unique.supportingAffixes).toHaveLength(3);

      const definition = gearDefinitions[unique.id];
      expect(definition).toBeDefined();
      expect(definition.rarity).toBe("unique");
      expect(definition.art).toBeTruthy();

      expect(gearAffixCatalog[unique.signatureAffix.id]?.uniqueOnly).toBe(true);
      for (const supporting of unique.supportingAffixes) {
        expect(gearAffixCatalog[supporting.id]?.uniqueOnly).toBeFalsy();
        expect(supporting.value).toBe(gearAffixCatalog[supporting.id].roll.unique.max);
      }

      const instance = generateUniqueGearInstance(unique);
      expect(instance.definitionId).toBe(unique.id);
      expect(instance.affixes).toHaveLength(4);
      expect(instance.affixes[0]).toEqual(unique.signatureAffix);
      expect(instance.affixes.slice(1)).toEqual(unique.supportingAffixes);
      expect(getGearInstanceTitle(instance)).toBe(unique.displayName);
    }
  });

  it("prevents crafting currencies from modifying unique items", () => {
    const unique = uniqueItemList[0];
    const instance = generateUniqueGearInstance(unique);
    expect(canApplyCraftingCurrency("discordant-dice", instance)).toBe(false);
    expect(canApplyCraftingCurrency("ascension-seal", instance)).toBe(false);
    expect(canApplyCraftingCurrency("severance-maw", instance)).toBe(false);
    expect(canApplyCraftingCurrency("smiths-whetstone", instance)).toBe(false);
  });

  it("yields guaranteed salvage currency package on unique salvage", () => {
    const yieldMats = rollSalvageYield("unique", () => 0.5);
    expect(yieldMats["discordant-dice"]).toBe(2);
    expect(yieldMats["ascension-seal"]).toBe(1);
    expect(yieldMats["severance-maw"]).toBe(1);
    expect(yieldMats["smiths-whetstone"]).toBe(1);
  });

  it("prices unique items at EQUIPMENT_SHOP_UNIQUE_PRICE in equipment shops", () => {
    const unique = uniqueItemList[0];
    const instance = generateUniqueGearInstance(unique);
    expect(getEquipmentShopPrice(instance)).toBe(EQUIPMENT_SHOP_UNIQUE_PRICE);
  });

  it("excludes owned uniques from equipment shop offerings and degrades when all owned", () => {
    const allOwnedIds = new Set(uniqueItemList.map((u) => u.id));
    const offerings = generateEquipmentShopOfferings(3, () => 0.01, 0, allOwnedIds);
    expect(offerings).toHaveLength(3);

    for (const offering of offerings) {
      expect(gearDefinitions[offering.definitionId]?.rarity).toBe("astral");
    }
  });
});

describe("fixed Unique compatibility", () => {
  it.each(uniqueItemList)("repairs saved $displayName without changing ownership or protection", (unique) => {
    const original: GearInstance = {
      instanceId: "owned-id",
      definitionId: unique.id,
      protected: true,
      affixes: [{ id: "flat-physical", value: 99 }],
    };
    const expected = [unique.signatureAffix, ...unique.supportingAffixes];
    const normalized = normalizeGearInstance(original)!;
    expect(normalized).toEqual({ ...original, affixes: expected });
    expect(normalizeGearInstance(normalized)).toEqual(normalized);
    expect(effectsForInstance(original)).toEqual(effectsForInstance(normalized));
    expect(getGearInstanceTooltipEntries(original)).toEqual(getGearInstanceTooltipEntries(normalized));
  });

  it("keeps the 21 new signature descriptions short and free of technical wording", () => {
    for (const unique of uniqueItemList.slice(8)) {
      expect(unique.description.split(/\s+/).length, unique.displayName).toBeLessThanOrEqual(15);
      expect(unique.description).not.toMatch(/\b(tick|manually|resolving|triggered|commands|stacking|readies)\b/i);
    }
  });

  it("does not share mutable rolls between instances or the catalog", () => {
    const unique = uniqueItemList[0];
    const first = generateUniqueGearInstance(unique);
    const second = generateUniqueGearInstance(unique);
    first.affixes[1].value = 999;
    expect(second.affixes[1]).toEqual(unique.supportingAffixes[0]);
    expect(unique.supportingAffixes[0].value).not.toBe(999);
  });
});
