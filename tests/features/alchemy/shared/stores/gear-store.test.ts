import { describe, expect, it } from "vitest";
import {
  createEmptyGearInventories,
  createEmptyGearLoadouts,
  flattenGearInventories,
  generateUniqueGearInstance,
  getUniqueItemDefinition,
  type GearInstance,
} from "@/lib/gear";
import { mutateGearForTest, resetGearForTest, resetProfileForTest } from "../../../../helpers/gameplay-store-test";
import { createInitialGearState } from "@/features/alchemy/shared/stores/gear-store-initial-state";
import { readGearState } from "@/features/alchemy/shared/stores/gear-store";
import { readProfileStore } from "@/features/alchemy/shared/stores/profile-store";
import {
  dispatchGearMutationWithRunHealthSync,
  dispatchGearSalvageWithMaterialGrant,
} from "@/features/alchemy/shared/stores/gear-session-command";

function knightInventories(...items: GearInstance[]) {
  const inventories = createEmptyGearInventories();
  inventories.knight = items;
  return inventories;
}

describe("gear-store", () => {
  const ring: GearInstance = { instanceId: "ring-1", definitionId: "ruby-ring-basic", affixes: [] };
  const armor: GearInstance = { instanceId: "armor-1", definitionId: "leather-armor-basic", affixes: [] };

  it("creates fresh state references per call", () => {
    const first = createInitialGearState();
    const second = createInitialGearState();
    expect(first.inventories).not.toBe(second.inventories);
    expect(first.loadouts).not.toBe(second.loadouts);
    expect(first.equippedTrinkets).not.toBe(second.equippedTrinkets);
    expect(first.craftingCurrencies).not.toBe(second.craftingCurrencies);
    expect(first.ownedTrinketIds).not.toBe(second.ownedTrinketIds);
  });

  it("initializes inventory and loadouts from save data", () => {
    const loadouts = createEmptyGearLoadouts();
    loadouts.knight["left-accessory"] = ring.instanceId;
    mutateGearForTest((gear) => gear.initialize(knightInventories(ring), loadouts));
    expect(readGearState().inventories.knight).toEqual([ring]);
    expect(readGearState().loadouts.knight["left-accessory"]).toBe("ring-1");
    resetGearForTest();
  });

  it("updates loadouts on equip and inventory on salvage", () => {
    resetGearForTest();
    mutateGearForTest((gear) => gear.addInstance(ring, "knight"));
    mutateGearForTest((gear) => gear.equip("knight", "left-accessory", ring));
    expect(readGearState().loadouts.knight["left-accessory"]).toBe("ring-1");

    const salvaged = mutateGearForTest((gear) => gear.salvage(ring.instanceId, { rng: () => 0 }));
    expect(salvaged?.inventories.knight).toEqual([]);
    expect(readGearState().loadouts.knight["left-accessory"]).toBeNull();
    expect(flattenGearInventories(readGearState().inventories)).toEqual([]);
    resetGearForTest();
  });

  it("swaps the occupied slot when equipping another item", () => {
    resetGearForTest();
    const ringB: GearInstance = { instanceId: "ring-2", definitionId: "sapphire-ring-basic", affixes: [] };
    mutateGearForTest((gear) => gear.initialize(knightInventories(ring, ringB), createEmptyGearLoadouts()));
    mutateGearForTest((gear) => gear.equip("knight", "left-accessory", ring));
    mutateGearForTest((gear) => gear.equip("knight", "left-accessory", ringB));
    expect(readGearState().loadouts.knight["left-accessory"]).toBe("ring-2");
    resetGearForTest();
  });

  it("reports armory lock state from inventory", () => {
    resetGearForTest();
    expect(flattenGearInventories(readGearState().inventories).length === 0).toBe(true);
    mutateGearForTest((gear) => gear.addInstance(armor, "knight"));
    expect(flattenGearInventories(readGearState().inventories).length === 0).toBe(false);
    resetGearForTest();
  });

  it("owns one permanent copy and moves it exclusively between character loadouts", () => {
    resetGearForTest();
    expect(mutateGearForTest((gear) => gear.addTrinket("bone-charm"))).toBe(true);
    expect(mutateGearForTest((gear) => gear.addTrinket("bone-charm"))).toBe(false);
    expect(readGearState().ownedTrinketIds).toEqual(["bone-charm"]);

    expect(mutateGearForTest((gear) => gear.equipTrinket("knight", "bone-charm"))).toBe(true);
    expect(readGearState().equippedTrinkets.knight).toBe("bone-charm");
    expect(mutateGearForTest((gear) => gear.equipTrinket("rogue", "bone-charm"))).toBe(true);
    expect(readGearState().equippedTrinkets.knight).toBeNull();
    expect(readGearState().equippedTrinkets.rogue).toBe("bone-charm");
  });

  it("rejects unknown or unowned permanent trinkets", () => {
    resetGearForTest();
    expect(mutateGearForTest((gear) => gear.addTrinket("missing-trinket"))).toBe(false);
    expect(mutateGearForTest((gear) => gear.equipTrinket("knight", "bone-charm"))).toBe(false);
  });

  it("records unique discovery on obtain and keeps it after salvage", () => {
    resetGearForTest();
    resetProfileForTest();
    const uniqueDef = getUniqueItemDefinition("wardbreaker");
    if (!uniqueDef) throw new Error("missing wardbreaker unique");
    const unique = generateUniqueGearInstance(uniqueDef);

    dispatchGearMutationWithRunHealthSync({
      mutate: (gear) => gear.addInstance(unique, "knight"),
    });
    expect(readProfileStore().discoveredUniqueIds).toEqual(["wardbreaker"]);

    dispatchGearSalvageWithMaterialGrant((gear) => gear.salvage(unique.instanceId, { rng: () => 0 }));
    expect(flattenGearInventories(readGearState().inventories)).toEqual([]);
    expect(readProfileStore().discoveredUniqueIds).toEqual(["wardbreaker"]);
    resetGearForTest();
  });
});
