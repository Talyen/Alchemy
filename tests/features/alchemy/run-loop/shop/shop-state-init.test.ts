import { describe, expect, it } from "vitest";
import {
  createInitialShopState as createInitialShopStateImpl,
  createInitialAlchemistState as createInitialAlchemistStateImpl,
  createInitialTrinketShopState as createInitialTrinketShopStateImpl,
  createInitialEquipmentShopState as createInitialEquipmentShopStateImpl,
  resampleTrinketShopOfferings,
} from "@/features/alchemy/run-loop/shop/shop-state-init";
import {
  hydrateAlchemistState,
  hydrateEquipmentShopState,
  hydrateShopState,
  hydrateTrinketShopState,
  serializeAlchemistState,
  serializeEquipmentShopState,
  serializeShopState,
  serializeTrinketShopState,
  shopItemSlotKey,
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

  it("round-trips merchant shop state through persistence helpers", () => {
    const state = createInitialShopState();
    const purchased = shopItemSlotKey(state.cards[0]!.id, 0);
    state.refreshesLeft = 1;
    state.firstPurchaseUsed = true;
    state.purchasedSlotKeys = [purchased];
    const restored = hydrateShopState(serializeShopState(state));
    expect(restored.cards.map((card) => card.id)).toEqual(state.cards.map((card) => card.id));
    expect(restored.purchasedSlotKeys).toEqual([purchased]);
    expect(restored.removeUsed).toBe(false);
  });

  it("round-trips alchemist shop state through persistence helpers", () => {
    const state = createInitialAlchemistState();
    const purchased = shopItemSlotKey(state.potions[0]!.id, 0);
    state.mixUsed = true;
    state.purchasedSlotKeys = [purchased];
    const restored = hydrateAlchemistState(serializeAlchemistState(state));
    expect(restored.potions.map((card) => card.id)).toEqual(state.potions.map((card) => card.id));
    expect(restored.purchasedSlotKeys).toEqual([purchased]);
    expect(restored.mixUsed).toBe(true);
  });

  it("round-trips trinket shop state through persistence helpers", () => {
    const state = createInitialTrinketShopState(() => 0.1);
    const purchased = shopItemSlotKey(state.trinkets[0]!.id, 0);
    state.refreshesLeft = 2;
    state.firstPurchaseUsed = true;
    state.purchasedSlotKeys = [purchased];
    const restored = hydrateTrinketShopState(serializeTrinketShopState(state));
    expect(restored.trinkets.map((trinket) => trinket.id)).toEqual(state.trinkets.map((trinket) => trinket.id));
    expect(restored.refreshesLeft).toBe(2);
    expect(restored.firstPurchaseUsed).toBe(true);
    expect(restored.purchasedSlotKeys).toEqual([purchased]);
  });

  it("remaps purchased keys when a persisted trinket id is missing from the catalog", () => {
    const liveA = trinketLibrary[0]!;
    const liveB = trinketLibrary[1]!;
    const restored = hydrateTrinketShopState({
      trinketIds: [liveA.id, "not-a-real-trinket", liveB.id],
      refreshesLeft: 1,
      firstPurchaseUsed: true,
      purchasedSlotKeys: [shopItemSlotKey(liveB.id, 2)],
    });
    expect(restored.trinkets.map((entry) => entry.id)).toEqual([liveA.id, liveB.id]);
    expect(restored.purchasedSlotKeys).toEqual([shopItemSlotKey(liveB.id, 1)]);
  });

  it("round-trips equipment shop state through persistence helpers", () => {
    const state = createInitialEquipmentShopState(() => 0.2);
    state.refreshesLeft = 1;
    const restored = hydrateEquipmentShopState(serializeEquipmentShopState(state));
    expect(restored.gear.map((item) => item.instanceId)).toEqual(state.gear.map((item) => item.instanceId));
    expect(restored.refreshesLeft).toBe(1);
  });

  it("drops unknown equipment definitions and orphan purchase keys on hydrate", () => {
    const live = {
      instanceId: "shelf-basic",
      definitionId: "leather-armor-basic",
      affixes: [] as const,
    };
    const restored = hydrateEquipmentShopState({
      gear: [{ instanceId: "gone", definitionId: "not-a-real-definition", affixes: [] }, live],
      refreshesLeft: 1,
      firstPurchaseUsed: true,
      purchasedSlotKeys: ["gone", "shelf-basic", "orphan-slot"],
    });
    expect(restored.gear.map((item) => item.instanceId)).toEqual(["shelf-basic"]);
    expect(restored.purchasedSlotKeys).toEqual(["shelf-basic"]);
  });
});
