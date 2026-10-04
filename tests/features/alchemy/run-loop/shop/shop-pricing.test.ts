import { describe, expect, it } from "vitest";
import { getShopBuyPrice, getShopRefreshPrice } from "@/features/alchemy/run-loop/shop/shop-pricing";
import {
  ALCHEMIST_REFRESH_PRICE,
  EQUIPMENT_SHOP_ASTRAL_PRICE,
  EQUIPMENT_SHOP_BASIC_PRICE,
  EQUIPMENT_SHOP_UNIQUE_PRICE,
  SHOP_REFRESH_PRICE,
} from "@/lib/game-constants";
import { cardById, createEmptyTalentEffectManifest } from "@/lib/game-data";

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
    expect(getShopBuyPrice("merchantCard", cardById["slash"]!, { ...context, modifiers: ["bargain-bin"] })).toBe(3);
    expect(getShopBuyPrice("trinket", null, { ...context, modifiers: ["collectors-favor"] })).toBe(63);
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
    expect(getShopRefreshPrice(kind, restock, 1, [], true)).toBe(basePrice);
    for (const trait of ["fresh-curios", "fresh-batch"] as const) {
      expect(getShopRefreshPrice(kind, talents, 1, [trait])).toBe(trait === freeTrait ? 0 : basePrice);
      expect(getShopRefreshPrice(kind, talents, 0, [trait])).toBe(basePrice);
    }
  });

  it("limits apprentice pricing to Basic gear even with unrelated shop traits present", () => {
    const context = {
      talentEffects: createEmptyTalentEffectManifest(),
      runBoons: [],
      firstPurchaseUsed: true,
      modifiers: ["apprentice", "bargain-bin", "happy-hour", "collectors-favor"] as const,
    };
    for (const [definitionId, price] of [
      ["leather-armor-basic", 20],
      ["longsword-astral", EQUIPMENT_SHOP_ASTRAL_PRICE],
      ["oathkeeper", EQUIPMENT_SHOP_UNIQUE_PRICE],
      ["missing-definition", EQUIPMENT_SHOP_BASIC_PRICE],
    ] as const) {
      expect(getShopBuyPrice("gear", { instanceId: definitionId, definitionId, affixes: [] }, context)).toBe(price);
    }
  });
});
