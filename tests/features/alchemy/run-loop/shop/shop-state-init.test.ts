import { describe, expect, it } from "vitest";
import {
  createInitialShopState as createInitialShopStateImpl,
  createInitialAlchemistState as createInitialAlchemistStateImpl,
  createInitialTrinketShopState as createInitialTrinketShopStateImpl,
  createInitialEquipmentShopState as createInitialEquipmentShopStateImpl,
  resampleTrinketShopOfferings,
} from "@/features/alchemy/run-loop/shop/shop-state-init";
import {
  serializeTrinketShopState,
  hydrateTrinketShopState,
  serializeEquipmentShopState,
  hydrateEquipmentShopState,
} from "@/lib/active-run-session";
import {
  SHOP_CARDS_OFFERED,
  ALCHEMIST_POTIONS_OFFERED,
  TRINKET_SHOP_OFFERED,
  EQUIPMENT_SHOP_OFFERED,
} from "@/lib/game-constants";
import { trinketLibrary } from "@/lib/game-data";

const testRng = () => 0.5;
const createInitialShopState = () => createInitialShopStateImpl([], testRng);
const createInitialAlchemistState = () => createInitialAlchemistStateImpl([], testRng);
const createInitialTrinketShopState = (rng: () => number = testRng) => createInitialTrinketShopStateImpl(rng);
const createInitialEquipmentShopState = (rng: () => number = testRng) => createInitialEquipmentShopStateImpl(rng);

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

  it("restocks around owned trinkets instead of offering them", () => {
    const owned = trinketLibrary[0];
    expect(owned).toBeDefined();
    const ownedId = owned!.id;
    const offerings = resampleTrinketShopOfferings(() => 0, [ownedId]);
    expect(offerings).toHaveLength(TRINKET_SHOP_OFFERED);
    expect(offerings.map((entry) => entry.id)).not.toContain(ownedId);
  });

  it("shortens the shelf when fewer unowned trinkets remain than slots", () => {
    const keep = trinketLibrary.slice(0, 2).map((entry) => entry.id);
    const owned = trinketLibrary.filter((entry) => !keep.includes(entry.id)).map((entry) => entry.id);
    const offerings = resampleTrinketShopOfferings(() => 0, owned);
    expect(offerings.map((entry) => entry.id).sort()).toEqual([...keep].sort());
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
