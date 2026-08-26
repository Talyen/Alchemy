import { describe, expect, it } from "vitest";
import { shopItemSlotKey } from "@/features/alchemy/run-loop/shop/shop-slot-keys";
import {
  getRunProgressStoreView,
  getRunSessionStoreView,
  setRunProgress,
} from "../../../../helpers/run-domain-store-test";
import { subscribeRunSessionCommits } from "@/features/alchemy/shared/stores/run-session-command";
import {
  buildActions,
  createInitialAlchemistState,
  createInitialEquipmentShopState,
  createInitialShopState,
  createInitialTrinketShopState,
  requiredItem,
  setAlchemistState,
  setEquipmentShopState,
  setShopState,
  setTrinketShopState,
} from "./shop-actions-harness";
import { SHOP_REFRESH_PRICE } from "@/lib/game-constants";
import { playGoldSpend } from "@/lib/audio";

describe("shop action isolation", () => {
  describe.each([
    {
      name: "merchant",
      seed: () => setShopState({ ...createInitialShopState(), refreshesLeft: 1 }),
      refresh: (actions: ReturnType<typeof buildActions>) => actions.merchant.refresh(),
      read: () => getRunSessionStoreView().shopState,
      price: SHOP_REFRESH_PRICE,
    },
    {
      name: "trinket",
      seed: () => {
        const initial = createInitialTrinketShopState(() => 0);
        setTrinketShopState({
          ...initial,
          purchasedSlotKeys: [`${initial.trinkets[0]?.id}-0`],
          refreshesLeft: 1,
        });
      },
      refresh: (actions: ReturnType<typeof buildActions>) => actions.trinket.refresh(),
      read: () => getRunSessionStoreView().trinketShopState,
      price: SHOP_REFRESH_PRICE,
    },
    {
      name: "equipment",
      seed: () => {
        const initial = createInitialEquipmentShopState();
        setEquipmentShopState({
          ...initial,
          purchasedSlotKeys: [initial.gear[0]?.instanceId ?? "missing"],
          refreshesLeft: 1,
        });
      },
      refresh: (actions: ReturnType<typeof buildActions>) => actions.equipment.refresh(),
      read: () => getRunSessionStoreView().equipmentShopState,
      price: SHOP_REFRESH_PRICE,
    },
  ])("$name refresh", ({ seed, refresh, read, price }) => {
    it("deducts gold, decrements refreshesLeft, and clears purchased slots", () => {
      setRunProgress({ gold: 999 });
      seed();
      const actions = buildActions();
      const commits: number[] = [];
      const unsubscribe = subscribeRunSessionCommits((revision) => commits.push(revision));

      expect(refresh(actions)).toBe(true);
      unsubscribe();

      expect(read().refreshesLeft).toBe(0);
      expect(getRunProgressStoreView().gold).toBe(999 - price);
      expect(read().purchasedSlotKeys).toEqual([]);
      expect(commits).toHaveLength(1);
      expect(playGoldSpend).toHaveBeenCalledOnce();
    });
  });
  describe("per-shop isolation", () => {
    it("buying in merchant shop does not affect alchemist state", () => {
      setRunProgress({ gold: 999 });
      setShopState(createInitialShopState());
      setAlchemistState(createInitialAlchemistState());
      const actions = buildActions();
      const card = requiredItem(getRunSessionStoreView().shopState.cards[0], "merchant card");

      actions.merchant.buyCard(card, shopItemSlotKey(card.id, 0));

      expect(getRunSessionStoreView().alchemistState.firstPurchaseUsed).toBe(false);
    });
  });
});
