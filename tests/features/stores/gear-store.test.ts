import { describe, expect, it } from "vitest";
import {
  createEmptyGearLoadouts,
  equipGear,
  isArmoryLocked,
  salvageGear,
  type GearInstance,
} from "@/lib/gear";
import { useGearStore } from "@/features/alchemy/shared/stores/gear-store";

describe("gear-store", () => {
  const ring: GearInstance = { instanceId: "ring-1", definitionId: "placeholder-ring", affixIds: [] };

  it("initializes inventory, loadouts, and board positions from save data", () => {
    const loadouts = equipGear(createEmptyGearLoadouts(), "knight", "left-ring", ring, [ring]);
    const boardPositions = { [ring.instanceId]: { col: 2, row: 3 } };
    useGearStore.getState().initialize([ring], loadouts, boardPositions);
    expect(useGearStore.getState().inventory).toEqual([ring]);
    expect(useGearStore.getState().loadouts.knight["left-ring"]).toBe("ring-1");
    expect(useGearStore.getState().boardPositions).toEqual(boardPositions);
    useGearStore.getState().reset();
  });

  it("updates loadouts on equip and inventory on salvage", () => {
    useGearStore.getState().reset();
    useGearStore.getState().addInstance(ring);
    useGearStore.getState().equip("knight", "left-ring", ring);
    expect(useGearStore.getState().loadouts.knight["left-ring"]).toBe("ring-1");

    const result = useGearStore.getState().salvage(ring.instanceId);
    expect(result).toBeNull();

    useGearStore.getState().unequip("knight", "left-ring");
    const salvaged = useGearStore.getState().salvage(ring.instanceId);
    expect(salvaged?.inventory).toEqual([]);
    expect(useGearStore.getState().inventory).toEqual([]);
    useGearStore.getState().reset();
  });

  it("prunes stale board positions when salvaging gear", () => {
    useGearStore.getState().reset();
    useGearStore.getState().initialize([ring], createEmptyGearLoadouts(), {
      [ring.instanceId]: { col: 1, row: 1 },
    });
    useGearStore.getState().salvage(ring.instanceId);
    expect(useGearStore.getState().boardPositions).toEqual({});
    useGearStore.getState().reset();
  });

  it("reports armory lock state from inventory", () => {
    expect(isArmoryLocked([])).toBe(true);
    expect(isArmoryLocked([ring])).toBe(false);
  });
});
