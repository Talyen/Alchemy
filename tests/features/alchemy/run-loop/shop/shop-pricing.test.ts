import { describe, expect, it } from "vitest";
import {
  computeShopBuyPrice,
  computeShopServicePrice,
  getCardBuyTalentDiscounts,
  getEquipmentShopPrice,
  getGenericBuyTalentDiscounts,
  getShopBuyPrice,
  getShopRefreshPrice,
} from "@/features/alchemy/run-loop/shop/shop-pricing";
import {
  ALCHEMIST_POTION_PRICE,
  ALCHEMIST_REFRESH_PRICE,
  EQUIPMENT_SHOP_ASTRAL_PRICE,
  EQUIPMENT_SHOP_BASIC_PRICE,
  EQUIPMENT_SHOP_UNIQUE_PRICE,
  SHOP_CARD_PRICE,
  SHOP_REFRESH_PRICE,
  TRINKET_SHOP_TRINKET_PRICE,
} from "@/lib/game-constants";
import { generateGearRewardChoices, gearDefinitions } from "@/lib/gear";
import { cardById, cardLibrary, createEmptyTalentEffectManifest } from "@/lib/game-data";

describe("shop-pricing", () => {
  it("computeShopBuyPrice applies haggle only for generic items", () => {
    expect(
      computeShopBuyPrice({
        basePrice: TRINKET_SHOP_TRINKET_PRICE,
        haggleDiscount: 5,
        firstPurchaseUsed: false,
      }),
    ).toBe(TRINKET_SHOP_TRINKET_PRICE - 5);
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
      }),
    ).toBe(TRINKET_SHOP_TRINKET_PRICE - 7);
  });

  it.each([
    { kind: "merchant", basePrice: SHOP_REFRESH_PRICE, freeTrait: null },
    { kind: "equipment", basePrice: SHOP_REFRESH_PRICE, freeTrait: null },
    { kind: "trinket", basePrice: SHOP_REFRESH_PRICE, freeTrait: "fresh-curios" },
    { kind: "alchemist", basePrice: ALCHEMIST_REFRESH_PRICE, freeTrait: "fresh-batch" },
  ] as const)("$kind refresh prices preserve talents, traits, and exhaustion", ({ kind, basePrice, freeTrait }) => {
    const talents = createEmptyTalentEffectManifest();
    const restock = { ...talents, shopFreeRefresh: true };
    expect(getShopRefreshPrice(kind, talents, 1)).toBe(basePrice);
    expect(getShopRefreshPrice(kind, restock, 1)).toBe(0);
    expect(getShopRefreshPrice(kind, restock, 0)).toBe(basePrice);
    for (const trait of ["fresh-curios", "fresh-batch"] as const) {
      expect(getShopRefreshPrice(kind, talents, 1, [trait])).toBe(trait === freeTrait ? 0 : basePrice);
      expect(getShopRefreshPrice(kind, talents, 0, [trait])).toBe(basePrice);
    }
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
    const astralChoices = generateGearRewardChoices(10, () => 0.08);
    const basicChoices = generateGearRewardChoices(10, () => 0.99);
    const uniqueChoices = generateGearRewardChoices(10, () => 0.01);
    expect(astralChoices.some((c) => getEquipmentShopPrice(c) === EQUIPMENT_SHOP_ASTRAL_PRICE)).toBe(true);
    expect(basicChoices.some((c) => getEquipmentShopPrice(c) === EQUIPMENT_SHOP_BASIC_PRICE)).toBe(true);
    expect(uniqueChoices.some((c) => getEquipmentShopPrice(c) === EQUIPMENT_SHOP_UNIQUE_PRICE)).toBe(true);
  });

  it("getShopBuyPrice halves the merchant base price under bargain-bin before talent discounts", () => {
    const card = cardById["strike"] ?? cardLibrary[0]!;
    const talents = { ...createEmptyTalentEffectManifest(), shopCardDiscount: 5 };
    expect(
      getShopBuyPrice("merchantCard", card, { talentEffects: talents, runBoons: [], firstPurchaseUsed: true }),
    ).toBe(SHOP_CARD_PRICE - 5);
    expect(
      getShopBuyPrice("merchantCard", card, {
        talentEffects: talents,
        runBoons: [],
        firstPurchaseUsed: true,
        modifiers: ["bargain-bin"],
      }),
    ).toBe(Math.round(SHOP_CARD_PRICE * 0.5) - 5);
  });

  it("getShopBuyPrice halves alchemist potions under happy-hour", () => {
    const potion = cardLibrary.find((c) => c.id === "health-potion")!;
    const talents = createEmptyTalentEffectManifest();
    expect(
      getShopBuyPrice("alchemistPotion", potion, {
        talentEffects: talents,
        runBoons: [],
        firstPurchaseUsed: true,
        modifiers: ["happy-hour"],
      }),
    ).toBe(Math.round(ALCHEMIST_POTION_PRICE * 0.5));
  });

  it("getShopBuyPrice applies collectors-favor to trinkets", () => {
    const talents = createEmptyTalentEffectManifest();
    expect(getShopBuyPrice("trinket", null, { talentEffects: talents, runBoons: [], firstPurchaseUsed: true })).toBe(
      TRINKET_SHOP_TRINKET_PRICE,
    );
    expect(
      getShopBuyPrice("trinket", null, {
        talentEffects: talents,
        runBoons: [],
        firstPurchaseUsed: true,
        modifiers: ["collectors-favor"],
      }),
    ).toBe(Math.round(TRINKET_SHOP_TRINKET_PRICE * 0.75));
  });

  it("getShopBuyPrice halves only basic gear under apprentice", () => {
    const talents = createEmptyTalentEffectManifest();
    const basicId = Object.keys(gearDefinitions).find((id) => gearDefinitions[id]?.rarity === "basic")!;
    const astralId = Object.keys(gearDefinitions).find((id) => gearDefinitions[id]?.rarity === "astral")!;
    const basic = { instanceId: "basic-1", definitionId: basicId, affixes: [] };
    const astral = { instanceId: "astral-1", definitionId: astralId, affixes: [] };
    expect(
      getShopBuyPrice("gear", basic, {
        talentEffects: talents,
        runBoons: [],
        firstPurchaseUsed: true,
        modifiers: ["apprentice"],
      }),
    ).toBe(Math.round(EQUIPMENT_SHOP_BASIC_PRICE * 0.5));
    expect(
      getShopBuyPrice("gear", astral, {
        talentEffects: talents,
        runBoons: [],
        firstPurchaseUsed: true,
        modifiers: ["apprentice"],
      }),
    ).toBe(EQUIPMENT_SHOP_ASTRAL_PRICE);
  });
});
