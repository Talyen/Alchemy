import { describe, expect, it } from "vitest";
import {
  createInitialShopState,
  createInitialAlchemistState,
  createInitialTrinketShopState,
  createInitialEquipmentShopState,
  serializeTrinketShopState,
  hydrateTrinketShopState,
  serializeEquipmentShopState,
  hydrateEquipmentShopState,
} from "@/features/alchemy/run-loop/shop/shop-state-init";
import {
  SHOP_CARDS_OFFERED,
  ALCHEMIST_POTIONS_OFFERED,
  TRINKET_SHOP_OFFERED,
  EQUIPMENT_SHOP_OFFERED,
} from "@/lib/game-constants";

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

  it("createInitialTrinketShopState samples three trinkets", () => {
    expect(createInitialTrinketShopState().trinkets.length).toBe(TRINKET_SHOP_OFFERED);
  });

  it("createInitialEquipmentShopState samples three gear pieces", () => {
    expect(createInitialEquipmentShopState().gear.length).toBe(EQUIPMENT_SHOP_OFFERED);
  });

  it("round-trips trinket shop state through persistence helpers", () => {
    const state = createInitialTrinketShopState(() => 0.1);
    state.refreshesLeft = 2;
    state.firstPurchaseUsed = true;
    state.purchasedSlotKeys = ["trinket-a-0"];
    const restored = hydrateTrinketShopState(serializeTrinketShopState(state));
    expect(restored.trinkets.map((trinket) => trinket.id)).toEqual(state.trinkets.map((trinket) => trinket.id));
    expect(restored.refreshesLeft).toBe(2);
    expect(restored.firstPurchaseUsed).toBe(true);
    expect(restored.purchasedSlotKeys).toEqual(["trinket-a-0"]);
  });

  it("round-trips equipment shop state through persistence helpers", () => {
    const state = createInitialEquipmentShopState(() => 0.2);
    state.refreshesLeft = 1;
    const restored = hydrateEquipmentShopState(serializeEquipmentShopState(state));
    expect(restored.gear.map((item) => item.instanceId)).toEqual(state.gear.map((item) => item.instanceId));
    expect(restored.refreshesLeft).toBe(1);
  });
});
