import { describe, expect, it } from "vitest";
import {
  createEmptyGearInventories,
  createEmptyGearLoadouts,
  flattenGearInventories,
  type GearInstance,
} from "@/lib/gear";
import { useGearStore } from "../../../../helpers/gameplay-store-test";

function knightInventories(...items: GearInstance[]) {
  const inventories = createEmptyGearInventories();
  inventories.knight = items;
  return inventories;
}

describe("gear-store", () => {
  const ring: GearInstance = { instanceId: "ring-1", definitionId: "ruby-ring-basic", affixes: [] };
  const armor: GearInstance = { instanceId: "armor-1", definitionId: "leather-armor-basic", affixes: [] };

  it("initializes inventory and loadouts from save data", () => {
    const loadouts = createEmptyGearLoadouts();
    loadouts.knight["left-ring"] = ring.instanceId;
    useGearStore.getState().initialize(knightInventories(ring), loadouts);
    expect(useGearStore.getState().inventories.knight).toEqual([ring]);
    expect(useGearStore.getState().loadouts.knight["left-ring"]).toBe("ring-1");
    useGearStore.getState().reset();
  });

  it("updates loadouts on equip and inventory on salvage", () => {
    useGearStore.getState().reset();
    useGearStore.getState().addInstance(ring, "knight");
    useGearStore.getState().equip("knight", "left-ring", ring);
    expect(useGearStore.getState().loadouts.knight["left-ring"]).toBe("ring-1");

    const salvaged = useGearStore.getState().salvage(ring.instanceId, { rng: () => 0 });
    expect(salvaged?.inventories.knight).toEqual([]);
    expect(useGearStore.getState().loadouts.knight["left-ring"]).toBeNull();
    expect(flattenGearInventories(useGearStore.getState().inventories)).toEqual([]);
    useGearStore.getState().reset();
  });

  it("swaps the occupied slot when equipping another item", () => {
    useGearStore.getState().reset();
    const ringB: GearInstance = { instanceId: "ring-2", definitionId: "sapphire-ring-basic", affixes: [] };
    useGearStore.getState().initialize(knightInventories(ring, ringB), createEmptyGearLoadouts());
    useGearStore.getState().equip("knight", "left-ring", ring);
    useGearStore.getState().equip("knight", "left-ring", ringB);
    expect(useGearStore.getState().loadouts.knight["left-ring"]).toBe("ring-2");
    useGearStore.getState().reset();
  });

  it("reports armory lock state from inventory", () => {
    useGearStore.getState().reset();
    expect(flattenGearInventories(useGearStore.getState().inventories).length === 0).toBe(true);
    useGearStore.getState().addInstance(armor, "knight");
    expect(flattenGearInventories(useGearStore.getState().inventories).length === 0).toBe(false);
    useGearStore.getState().reset();
  });
});
