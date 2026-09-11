import { describe, expect, it } from "vitest";
import { setRunProgress, setRunSession } from "../../../../helpers/run-domain-store-test";
import { readActiveRun, readRunProfile, readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { readGearState } from "@/features/alchemy/shared/stores/gear-store";
import { subscribeRunSessionCommits } from "@/features/alchemy/shared/stores/run-session-command";
import { buildActions, createInitialEquipmentShopState, setEquipmentShopState } from "./shop-actions-harness";
import type { GearInstance } from "@/lib/gear";
import { gearDefinitions } from "@/lib/gear";
import { readActivityData } from "@/lib/active-run-session";
describe("equipment shop actions", () => {
  it("refreshes away from the previous shelf when other equipment is available", () => {
    setRunProgress({ gold: 999, characterId: "knight" });
    const actions = buildActions();
    for (let visit = 0; visit < 10; visit++) {
      setEquipmentShopState(createInitialEquipmentShopState());
      const previous = readActivityData(readRunSession().activity, "equipment-shop").gear;
      const oldBases = new Set(previous.map((item) => gearDefinitions[item.definitionId]!.baseItemId));
      expect(actions.equipment.refresh()).toBe(true);
      const refreshed = readActivityData(readRunSession().activity, "equipment-shop").gear;
      expect(refreshed).toHaveLength(previous.length);
      expect(refreshed.every((item) => !oldBases.has(gearDefinitions[item.definitionId]!.baseItemId))).toBe(true);
    }
  });
  it("purchases the live shelf item when the supplied copy has different contents", () => {
    const onShelf: GearInstance = {
      instanceId: "shop-armor",
      definitionId: "leather-armor-basic",
      affixes: [{ id: "max-health", value: 7 }],
    };
    setRunProgress({ gold: 999, characterId: "knight" });
    setEquipmentShopState({ ...createInitialEquipmentShopState(), gear: [onShelf] });
    const actions = buildActions();
    expect(actions.equipment.buy({ ...onShelf, affixes: [{ id: "max-health", value: 999 }] }, onShelf.instanceId)).toBe(
      true,
    );
    expect(readGearState().inventories.knight).toContainEqual(onShelf);
    expect(readActiveRun().runObtainedItems).toEqual([{ kind: "gear", instance: onShelf }]);
    expect(readRunProfile().gold).toBe(999 - actions.equipment.getBuyPrice(onShelf));
  });
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

      const result = actions.equipment.buy(instance, instance.instanceId);

      unsubscribe();

      expect(result).toBe(true);
      expect(commits).toHaveLength(1);
      expect(readRunProfile().gold).toBe(999 - actions.equipment.getBuyPrice(instance));
      expect(readActivityData(readRunSession().activity, "equipment-shop").purchasedSlotKeys).toEqual([
        instance.instanceId,
      ]);
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

      expect(actions.equipment.buy(offMenu, offMenu.instanceId)).toBe(false);
      expect(readRunProfile().gold).toBe(999);
      expect(readGearState().inventories.knight ?? []).not.toContainEqual(offMenu);
    });
  });
});
