import { describe, expect, it } from "vitest";
import {
  getRunProgressStoreView,
  getRunSessionStoreView,
  setRunProgress,
} from "../../../../helpers/run-domain-store-test";
import { useGearStore, getRunTransientStore } from "../../../../helpers/gameplay-store-test";
import { subscribeRunSessionCommits } from "@/features/alchemy/shared/stores/run-session-command";
import { buildActions, createInitialEquipmentShopState, setEquipmentShopState } from "./shop-actions-harness";
import type { GearInstance } from "@/lib/gear";
import { createRunRngState } from "@/lib/run-rng";

describe("equipment shop actions", () => {
  describe("equipment shop", () => {
    it("persists gold, purchase slot, and gear inventory in one commit", () => {
      const instance: GearInstance = {
        instanceId: "shop-armor",
        definitionId: "leather-armor-basic",
        affixes: [{ id: "max-health", value: 7 }],
      };
      setRunProgress({ gold: 999, characterId: "knight", runMaxHealth: 30, runPlayerHealth: 30 });
      getRunTransientStore().setHasActiveRun(true);
      setEquipmentShopState({
        ...createInitialEquipmentShopState(),
        gear: [instance],
      });
      const actions = buildActions();
      const commits: number[] = [];
      const unsubscribe = subscribeRunSessionCommits((revision) => commits.push(revision));

      const result = actions.equipment.buy(instance);

      unsubscribe();

      expect(result).toBe(true);
      expect(commits).toHaveLength(1);
      expect(getRunProgressStoreView().gold).toBe(999 - actions.equipment.getBuyPrice(instance));
      expect(getRunSessionStoreView().equipmentShopState.purchasedSlotKeys).toEqual([instance.instanceId]);
      expect(useGearStore.getState().inventories.knight).toContainEqual(instance);
      expect(getRunProgressStoreView().runObtainedItems).toEqual([{ kind: "gear", instance }]);
      // Shop buy adds to inventory without equipping, so max-health affixes do not apply yet.
      // mutateGearWithRunHealthSync still runs in the same commit (delta 0).
      expect(getRunProgressStoreView().runMaxHealth).toBe(30);
      expect(getRunProgressStoreView().runPlayerHealth).toBe(30);
    });

    it("rejects a buy for gear that is not on the shelf", () => {
      const onShelf: GearInstance = {
        instanceId: "shop-armor",
        definitionId: "leather-armor-basic",
        affixes: [],
      };
      const offMenu: GearInstance = {
        instanceId: "off-menu",
        definitionId: "leather-armor-basic",
        affixes: [],
      };
      setRunProgress({ gold: 999, characterId: "knight" });
      setEquipmentShopState({
        ...createInitialEquipmentShopState(),
        gear: [onShelf],
      });
      const actions = buildActions();

      expect(actions.equipment.buy(offMenu)).toBe(false);
      expect(getRunProgressStoreView().gold).toBe(999);
      expect(useGearStore.getState().inventories.knight ?? []).not.toContainEqual(offMenu);
    });
  });
  describe("persisted RNG stream", () => {
    it("replays equipment shop init from the same RNG state", () => {
      const rng = () => 0.5;
      const rngState = createRunRngState(rng);
      setRunProgress({ gold: 999, rng: rngState });

      setEquipmentShopState(createInitialEquipmentShopState(rng));
      const firstActions = buildActions();
      firstActions.equipment.initialize();
      const firstGear = getRunSessionStoreView().equipmentShopState.gear.map((g) => g.definitionId);

      setEquipmentShopState(createInitialEquipmentShopState(rng));
      setRunProgress({ rng: rngState });
      const secondActions = buildActions();
      secondActions.equipment.initialize();
      const secondGear = getRunSessionStoreView().equipmentShopState.gear.map((g) => g.definitionId);

      expect(firstGear).toEqual(secondGear);
    });
  });
});
