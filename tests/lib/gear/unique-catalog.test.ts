import { describe, expect, it } from "vitest";
import {
  canApplyCraftingCurrency,
  generateEquipmentShopOfferings,
  generateUniqueGearInstance,
  gearAffixCatalog,
  gearDefinitions,
  getGearInstanceTitle,
  rollSalvageYield,
  uniqueItemList,
} from "@/lib/gear";
import { EQUIPMENT_SHOP_UNIQUE_PRICE } from "@/lib/game-constants";
import { getEquipmentShopPrice } from "@/features/alchemy/run-loop/shop/shop-pricing";

describe("unique item catalog", () => {
  it("contains 8 unique items with valid base items and exactly 4 affixes", () => {
    expect(uniqueItemList).toHaveLength(8);
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
