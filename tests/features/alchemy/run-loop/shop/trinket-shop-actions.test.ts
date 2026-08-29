import { describe, expect, it } from "vitest";
import { shopItemSlotKey } from "@/features/alchemy/run-loop/shop/shop-slot-keys";
import { setRunProgress } from "../../../../helpers/run-domain-store-test";
import { mutateGearForTest } from "../../../../helpers/gameplay-store-test";
import { readActiveRun, readRunProfile, readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { readGearState } from "@/features/alchemy/shared/stores/gear-store";
import { buildActions, createInitialTrinketShopState, requiredItem, setTrinketShopState } from "./shop-actions-harness";
import { TRINKET_SHOP_TRINKET_PRICE } from "@/lib/game-constants";

describe("trinket shop actions", () => {
  describe("trinket shop", () => {
    it("adds a permanent trinket on purchase without granting a boon", () => {
      setRunProgress({ gold: 999 });
      setTrinketShopState(createInitialTrinketShopState(() => 0));
      const actions = buildActions();
      const trinket = requiredItem(readRunSession().trinketShopState.trinkets[0], "trinket offering");

      expect(actions.trinket.buy(trinket, shopItemSlotKey(trinket.id, 0))).toBe(true);
      expect(readRunProfile().gold).toBe(999 - TRINKET_SHOP_TRINKET_PRICE);
      expect(readGearState().ownedTrinketIds).toContain(trinket.id);
      expect(readActiveRun().runBoons).not.toContain(trinket.id);
      expect(readActiveRun().runObtainedItems).toEqual([{ kind: "trinket", trinketId: trinket.id }]);
    });

    it("does not charge gold when the trinket is already owned", () => {
      setTrinketShopState(createInitialTrinketShopState(() => 0));
      const trinket = requiredItem(readRunSession().trinketShopState.trinkets[0], "trinket offering");
      setRunProgress({ gold: 999 });
      mutateGearForTest((gear) => gear.addTrinket(trinket.id));
      const actions = buildActions();

      const result = actions.trinket.buy(trinket, shopItemSlotKey(trinket.id, 0));

      expect(result).toBe(false);
      expect(readRunProfile().gold).toBe(999);
      expect(readGearState().ownedTrinketIds).toEqual([trinket.id]);
    });

    it("rejects a buy when the payload is not the live slot offering", () => {
      setRunProgress({ gold: 999 });
      setTrinketShopState(createInitialTrinketShopState(() => 0));
      const actions = buildActions();
      const offered = requiredItem(readRunSession().trinketShopState.trinkets[0], "trinket offering");
      const other = requiredItem(readRunSession().trinketShopState.trinkets[1], "other trinket");

      const result = actions.trinket.buy(other, shopItemSlotKey(offered.id, 0));

      expect(result).toBe(false);
      expect(readRunProfile().gold).toBe(999);
      expect(readActiveRun().runBoons).not.toContain(other.id);
    });
  });
});
