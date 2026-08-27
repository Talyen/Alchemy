import { describe, expect, it } from "vitest";
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
  type AlchemistState,
  type EquipmentShopState,
  type ShopState,
  type TrinketShopState,
} from "@/lib/active-run-session";
import { cardLibrary, trinketLibrary } from "@/lib/game-data";
import { createGearInstance } from "@/lib/gear";
import { gearDefinitions } from "@/lib/gear/definitions";

describe("shop-persistence", () => {
  const cardA = cardLibrary[0]!;
  const cardB = cardLibrary[1]!;
  const trinketA = trinketLibrary[0]!;
  const trinketB = trinketLibrary[1]!;

  describe("ShopState", () => {
    it("round-trips standard card shop state", () => {
      const state: ShopState = {
        cards: [cardA, cardB],
        removeUsed: true,
        refreshesLeft: 2,
        firstPurchaseUsed: true,
        purchasedSlotKeys: [shopItemSlotKey(cardA.id, 0)],
      };

      const serialized = serializeShopState(state);
      expect(serialized).toEqual({
        cards: [cardA, cardB],
        removeUsed: true,
        refreshesLeft: 2,
        firstPurchaseUsed: true,
        purchasedSlotKeys: [shopItemSlotKey(cardA.id, 0)],
      });

      const hydrated = hydrateShopState(serialized);
      expect(hydrated).toEqual(state);
    });

    it("hydrates fallback empty array when purchasedSlotKeys is missing", () => {
      const persisted = {
        cards: [cardA],
        removeUsed: false,
        refreshesLeft: 1,
        firstPurchaseUsed: false,
      } as unknown as Parameters<typeof hydrateShopState>[0];

      const hydrated = hydrateShopState(persisted);
      expect(hydrated.purchasedSlotKeys).toEqual([]);
    });
  });

  describe("AlchemistState", () => {
    it("round-trips alchemist potion state", () => {
      const state: AlchemistState = {
        potions: [cardA],
        mixUsed: true,
        refreshesLeft: 1,
        firstPurchaseUsed: false,
        purchasedSlotKeys: [],
      };

      const serialized = serializeAlchemistState(state);
      expect(serialized).toEqual({
        potions: [cardA],
        mixUsed: true,
        refreshesLeft: 1,
        firstPurchaseUsed: false,
        purchasedSlotKeys: [],
      });

      const hydrated = hydrateAlchemistState(serialized);
      expect(hydrated).toEqual(state);
    });
  });

  describe("TrinketShopState", () => {
    it("round-trips trinket shop state and maps trinketIds <-> TrinketEntry", () => {
      const state: TrinketShopState = {
        trinkets: [trinketA, trinketB],
        refreshesLeft: 2,
        firstPurchaseUsed: true,
        purchasedSlotKeys: [shopItemSlotKey(trinketA.id, 0)],
      };

      const serialized = serializeTrinketShopState(state);
      expect(serialized).toEqual({
        trinketIds: [trinketA.id, trinketB.id],
        refreshesLeft: 2,
        firstPurchaseUsed: true,
        purchasedSlotKeys: [shopItemSlotKey(trinketA.id, 0)],
      });

      const hydrated = hydrateTrinketShopState(serialized);
      expect(hydrated.trinkets).toEqual([trinketA, trinketB]);
      expect(hydrated.purchasedSlotKeys).toEqual([shopItemSlotKey(trinketA.id, 0)]);
    });

    it("repairs trinket offerings by dropping unknown IDs and remapping slot keys", () => {
      const persisted = {
        trinketIds: ["non-existent-trinket-id", trinketB.id],
        refreshesLeft: 1,
        firstPurchaseUsed: true,
        purchasedSlotKeys: [shopItemSlotKey(trinketB.id, 1)],
      };

      const hydrated = hydrateTrinketShopState(persisted);
      expect(hydrated.trinkets).toEqual([trinketB]);
      expect(hydrated.purchasedSlotKeys).toEqual([shopItemSlotKey(trinketB.id, 0)]);
    });
  });

  describe("EquipmentShopState", () => {
    it("round-trips equipment shop state", () => {
      const instance = createGearInstance(gearDefinitions["leather-armor-basic"]);
      const state: EquipmentShopState = {
        gear: [instance],
        refreshesLeft: 1,
        firstPurchaseUsed: false,
        purchasedSlotKeys: [instance.instanceId],
      };

      const serialized = serializeEquipmentShopState(state);
      expect(serialized).toEqual({
        gear: [instance],
        refreshesLeft: 1,
        firstPurchaseUsed: false,
        purchasedSlotKeys: [instance.instanceId],
      });

      const hydrated = hydrateEquipmentShopState(serialized);
      expect(hydrated).toEqual(state);
    });

    it("repairs equipment offerings by dropping invalid definition instances", () => {
      const validInstance = createGearInstance(gearDefinitions["leather-armor-basic"]);
      const invalidInstance = { instanceId: "bogus-1", definitionId: "non-existent-gear", affixes: [] };

      const persisted = {
        gear: [invalidInstance as unknown as ReturnType<typeof createGearInstance>, validInstance],
        refreshesLeft: 1,
        firstPurchaseUsed: true,
        purchasedSlotKeys: [validInstance.instanceId],
      };

      const hydrated = hydrateEquipmentShopState(persisted);
      expect(hydrated.gear).toEqual([validInstance]);
      expect(hydrated.purchasedSlotKeys).toEqual([validInstance.instanceId]);
    });
  });
});
