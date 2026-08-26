import { describe, expect, it } from "vitest";
import { shopItemSlotKey } from "@/features/alchemy/run-loop/shop/shop-slot-keys";
import {
  getRunProgressStoreView,
  getRunSessionStoreView,
  setRunProgress,
} from "../../../../helpers/run-domain-store-test";
import { useGearStore } from "../../../../helpers/gameplay-store-test";
import { buildActions, createInitialTrinketShopState, requiredItem, setTrinketShopState } from "./shop-actions-harness";
import { TRINKET_SHOP_TRINKET_PRICE } from "@/lib/game-constants";
import { createRunRngState } from "@/lib/run-rng";

describe("trinket shop actions", () => {
  describe("trinket shop", () => {
    it("deducts 100 gold and adds a permanent trinket on purchase", () => {
      setRunProgress({ gold: 999 });
      setTrinketShopState(createInitialTrinketShopState(() => 0));
      const actions = buildActions();
      const trinket = requiredItem(getRunSessionStoreView().trinketShopState.trinkets[0], "trinket offering");

      const result = actions.trinket.buy(trinket, shopItemSlotKey(trinket.id, 0));

      expect(result).toBe(true);
      expect(getRunProgressStoreView().gold).toBe(999 - TRINKET_SHOP_TRINKET_PRICE);
      expect(TRINKET_SHOP_TRINKET_PRICE).toBe(100);
      expect(useGearStore.getState().ownedTrinketIds).toContain(trinket.id);
      expect(getRunProgressStoreView().runBoons).not.toContain(trinket.id);
      expect(getRunProgressStoreView().runObtainedItems).toEqual([{ kind: "trinket", trinketId: trinket.id }]);
      expect(getRunSessionStoreView().trinketShopState.firstPurchaseUsed).toBe(true);
    });

    it("does not charge gold when the trinket is already owned", () => {
      setTrinketShopState(createInitialTrinketShopState(() => 0));
      const trinket = requiredItem(getRunSessionStoreView().trinketShopState.trinkets[0], "trinket offering");
      setRunProgress({ gold: 999 });
      useGearStore.getState().addTrinket(trinket.id);
      const actions = buildActions();

      const result = actions.trinket.buy(trinket, shopItemSlotKey(trinket.id, 0));

      expect(result).toBe(false);
      expect(getRunProgressStoreView().gold).toBe(999);
      expect(useGearStore.getState().ownedTrinketIds).toEqual([trinket.id]);
    });

    it("rejects a buy when the payload is not the live slot offering", () => {
      setRunProgress({ gold: 999 });
      setTrinketShopState(createInitialTrinketShopState(() => 0));
      const actions = buildActions();
      const offered = requiredItem(getRunSessionStoreView().trinketShopState.trinkets[0], "trinket offering");
      const other = requiredItem(getRunSessionStoreView().trinketShopState.trinkets[1], "other trinket");

      const result = actions.trinket.buy(other, shopItemSlotKey(offered.id, 0));

      expect(result).toBe(false);
      expect(getRunProgressStoreView().gold).toBe(999);
      expect(getRunProgressStoreView().runBoons).not.toContain(other.id);
    });
  });
  describe("persisted RNG stream", () => {
    it("replays trinket init and refresh from the same RNG state", () => {
      const rng = () => 0.25;
      const rngState = createRunRngState(rng);
      setRunProgress({ gold: 999, rng: rngState });
      setTrinketShopState(createInitialTrinketShopState(rng));

      const actions = buildActions();
      actions.trinket.initialize();
      const firstTrinkets = getRunSessionStoreView().trinketShopState.trinkets.map((t) => t.id);

      setTrinketShopState(createInitialTrinketShopState(rng));
      setRunProgress({ rng: rngState });
      const replayActions = buildActions();
      replayActions.trinket.initialize();
      const secondTrinkets = getRunSessionStoreView().trinketShopState.trinkets.map((t) => t.id);

      expect(firstTrinkets).toEqual(secondTrinkets);

      setTrinketShopState({
        ...createInitialTrinketShopState(rng),
        refreshesLeft: 1,
      });
      setRunProgress({ rng: rngState });
      const refreshActions = buildActions();
      refreshActions.trinket.refresh();
      const refreshedTrinkets = getRunSessionStoreView().trinketShopState.trinkets.map((t) => t.id);

      setTrinketShopState({
        ...createInitialTrinketShopState(rng),
        refreshesLeft: 1,
      });
      setRunProgress({ rng: rngState });
      const replayRefreshActions = buildActions();
      replayRefreshActions.trinket.refresh();
      const replayedTrinkets = getRunSessionStoreView().trinketShopState.trinkets.map((t) => t.id);

      expect(refreshedTrinkets).toEqual(replayedTrinkets);
    });
  });
});
