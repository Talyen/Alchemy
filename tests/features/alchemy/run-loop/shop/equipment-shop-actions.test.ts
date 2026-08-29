import { describe, expect, it } from "vitest";
import { setRunProgress, setRunSession } from "../../../../helpers/run-domain-store-test";
import { readActiveRun, readRunProfile, readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { readGearState } from "@/features/alchemy/shared/stores/gear-store";
import { subscribeRunSessionCommits } from "@/features/alchemy/shared/stores/run-session-command";
import { buildActions, createInitialEquipmentShopState, setEquipmentShopState } from "./shop-actions-harness";
import type { GearInstance } from "@/lib/gear";

describe("equipment shop actions", () => {
  describe("equipment shop", () => {
    it("persists gold, purchase slot, and gear inventory in one commit", () => {
      const instance: GearInstance = {
        instanceId: "shop-armor",
        definitionId: "leather-armor-basic",
        affixes: [{ id: "max-health", value: 7 }],
      };
      setRunProgress({ gold: 999, characterId: "knight", runMaxHealth: 30, runPlayerHealth: 30 });
      setRunSession({ hasActiveRun: true });
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
      expect(readRunProfile().gold).toBe(999 - actions.equipment.getBuyPrice(instance));
      expect(readRunSession().equipmentShopState.purchasedSlotKeys).toEqual([instance.instanceId]);
      expect(readGearState().inventories.knight).toContainEqual(instance);
      expect(readActiveRun().runObtainedItems).toEqual([{ kind: "gear", instance }]);

      expect(readActiveRun().runMaxHealth).toBe(30);
      expect(readActiveRun().runPlayerHealth).toBe(30);
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
      expect(readRunProfile().gold).toBe(999);
      expect(readGearState().inventories.knight ?? []).not.toContainEqual(offMenu);
    });
  });
});
