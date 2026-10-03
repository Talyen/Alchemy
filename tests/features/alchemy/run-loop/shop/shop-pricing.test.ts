import { describe, expect, it } from "vitest";
import {
  getEquipmentShopPrice,
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
import { gearDefinitions } from "@/lib/gear";
import { cardById, cardLibrary, createEmptyTalentEffectManifest } from "@/lib/game-data";

describe("shop-pricing", () => {
  it("stacks location, talent, Potion, and first-purchase discounts in the live quote", () => {
    const potion = cardById["health-potion"]!;
    const context = {
      talentEffects: { ...createEmptyTalentEffectManifest(), shopCardDiscount: 5, potionDiscount: 5 },
      runBoons: ["merchants-favor"],
      firstPurchaseUsed: false,
    };
    expect(getShopBuyPrice("alchemistPotion", potion, context)).toBe(13);
    expect(getShopBuyPrice("alchemistPotion", potion, { ...context, firstPurchaseUsed: true })).toBe(20);
    expect(getShopBuyPrice("alchemistPotion", potion, { ...context, modifiers: ["happy-hour"] })).toBe(0);
    expect(getShopBuyPrice("merchantCard", potion, context)).toBe(13);
    expect(getShopBuyPrice("merchantCard", cardById["slash"]!, context)).toBe(18);
    expect(getShopBuyPrice("trinket", null, context)).toBe(88);
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

  it.each([
    ["leather-armor-basic", EQUIPMENT_SHOP_BASIC_PRICE],
    ["longsword-astral", EQUIPMENT_SHOP_ASTRAL_PRICE],
    ["oathkeeper", EQUIPMENT_SHOP_UNIQUE_PRICE],
  ] as const)("quotes %s at its rarity price without generating random fixtures", (definitionId, price) => {
    const item = { instanceId: "item", definitionId, affixes: [] };
    expect(getEquipmentShopPrice(item)).toBe(price);
    expect(
      getShopBuyPrice("gear", item, {
        talentEffects: createEmptyTalentEffectManifest(),
        runBoons: [],
        firstPurchaseUsed: true,
      }),
    ).toBe(price);
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
