import { describe, expect, it } from "vitest";
import {
  computeShopBuyPrice,
  computeShopRefreshPrice,
  computeShopServicePrice,
  getCardBuyTalentDiscounts,
  getGenericBuyTalentDiscounts,
} from "@/features/alchemy/run-loop/shop/shop-pricing";
import { getEquipmentShopPrice } from "@/features/alchemy/run-loop/shop/shop-gear-pricing";
import {
  EQUIPMENT_SHOP_ASTRAL_PRICE,
  EQUIPMENT_SHOP_BASIC_PRICE,
  SHOP_REFRESH_PRICE,
  TRINKET_SHOP_TRINKET_PRICE,
} from "@/lib/game-constants";
import { generateGearRewardChoices } from "@/lib/gear";
import { cardLibrary } from "@/lib/game-data";

describe("shop-pricing", () => {
  it("computeShopBuyPrice applies haggle only for generic items", () => {
    expect(
      computeShopBuyPrice({
        basePrice: TRINKET_SHOP_TRINKET_PRICE,
        haggleDiscount: 5,
        firstPurchaseUsed: false,
        favorConsumed: true,
      }),
    ).toBe(45);
  });

  it("computeShopBuyPrice stacks haggle and apothecary on potions", () => {
    const potion = cardLibrary.find((c) => c.id === "health-potion")!;
    const { haggleDiscount, apothecaryDiscount } = getCardBuyTalentDiscounts(potion, {
      shopCardDiscount: 5,
      potionDiscount: 5,
    });
    expect(
      computeShopBuyPrice({
        basePrice: 20,
        haggleDiscount,
        apothecaryDiscount,
        firstPurchaseUsed: false,
        favorConsumed: true,
      }),
    ).toBe(10);
  });

  it("computeShopBuyPrice applies Merchant's Favor on first purchase", () => {
    expect(
      computeShopBuyPrice({
        basePrice: TRINKET_SHOP_TRINKET_PRICE,
        haggleDiscount: 0,
        merchantsFavorDiscount: 7,
        firstPurchaseUsed: false,
        favorConsumed: false,
      }),
    ).toBe(43);
  });

  it("computeShopRefreshPrice grants Restock on first refresh", () => {
    expect(computeShopRefreshPrice(SHOP_REFRESH_PRICE, true, 1)).toBe(0);
    expect(computeShopRefreshPrice(SHOP_REFRESH_PRICE, true, 0)).toBe(SHOP_REFRESH_PRICE);
  });

  it("computeShopServicePrice applies service discounts", () => {
    expect(computeShopServicePrice(50, 10)).toBe(40);
  });

  it("getGenericBuyTalentDiscounts exposes haggle only", () => {
    expect(getGenericBuyTalentDiscounts({ shopCardDiscount: 5 })).toEqual({
      haggleDiscount: 5,
      apothecaryDiscount: 0,
    });
  });

  it("getEquipmentShopPrice uses rarity", () => {
    const astralChoices = generateGearRewardChoices(10, () => 0.99);
    const basicChoices = generateGearRewardChoices(10, () => 0.01);
    expect(astralChoices.some((c) => getEquipmentShopPrice(c) === EQUIPMENT_SHOP_ASTRAL_PRICE)).toBe(true);
    expect(basicChoices.some((c) => getEquipmentShopPrice(c) === EQUIPMENT_SHOP_BASIC_PRICE)).toBe(true);
  });
});
