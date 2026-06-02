import { describe, expect, it } from "vitest";
import { createInitialShopState, createInitialAlchemistState } from "@/features/alchemy/shop/shop-state-init";
import { SHOP_CARDS_OFFERED, ALCHEMIST_POTIONS_OFFERED } from "@/lib/game-constants";

describe("shop-state-init", () => {
  it("createInitialShopState samples correct number of shop cards", () => {
    expect(createInitialShopState().cards.length).toBe(SHOP_CARDS_OFFERED);
  });

  it("createInitialShopState resets purchase flags", () => {
    const shop = createInitialShopState();
    expect(shop.removeUsed).toBe(false);
    expect(shop.firstPurchaseUsed).toBe(false);
    expect(shop.refreshesLeft).toBeGreaterThan(0);
  });

  it("createInitialAlchemistState samples correct number of potions", () => {
    expect(createInitialAlchemistState().potions.length).toBe(ALCHEMIST_POTIONS_OFFERED);
  });

  it("createInitialAlchemistState filters to only potion cards", () => {
    for (const potion of createInitialAlchemistState().potions) {
      expect(potion.id).toMatch(/-potion$/);
      expect(potion.id).not.toBe("mixed-potion");
      expect(potion.id.startsWith("mixed-potion-")).toBe(false);
    }
  });
});
