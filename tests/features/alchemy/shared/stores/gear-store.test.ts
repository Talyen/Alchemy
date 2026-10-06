import { describe, expect, it } from "vitest";
import {
  createEmptyEquippedTrinkets,
  createEmptyGearInventories,
  createEmptyGearLoadouts,
  EMPTY_CRAFTING_CURRENCIES,
  flattenGearInventories,
  generateUniqueGearInstance,
  getUniqueItemDefinition,
  type GearInstance,
} from "@/lib/gear";
import { mutateGearForTest, resetGearForTest, resetProfileForTest } from "../../../../helpers/run-domain-store-test";
import { createInitialGearState } from "@/features/alchemy/shared/stores/gear-actions";
import { acceptCommand, dispatchGameplayCommand } from "@/features/alchemy/shared/stores/gameplay-command";
import { gearPersistenceCodec, readGearState, readHasAnyOwnedGear } from "@/features/alchemy/shared/stores/gear-store";
import { readProfileStore } from "@/features/alchemy/shared/stores/profile-store";
import {
  dispatchGearMutationWithRunHealthSync,
  dispatchGearSalvageWithMaterialGrant,
} from "@/features/alchemy/shared/stores/gear-session-command";
import { defaultGameSession } from "@/app/application-session";

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
    expect(readGearState(defaultGameSession).inventories.knight).toEqual([ring]);
    expect(readGearState(defaultGameSession).loadouts.knight["left-accessory"]).toBe("ring-1");
    resetGearForTest();
  });

  it("updates loadouts on equip and inventory on salvage", () => {
    resetGearForTest();
    mutateGearForTest((gear) => gear.addInstance(ring, "knight"));
    mutateGearForTest((gear) => gear.equip("knight", "left-accessory", ring));
    expect(readGearState(defaultGameSession).loadouts.knight["left-accessory"]).toBe("ring-1");

    const salvaged = mutateGearForTest((gear) => gear.salvage(ring.instanceId));
    expect(salvaged).not.toBeNull();
    expect(readGearState(defaultGameSession).inventories.knight).toEqual([]);
    expect(readGearState(defaultGameSession).loadouts.knight["left-accessory"]).toBeNull();
    expect(flattenGearInventories(readGearState(defaultGameSession).inventories)).toEqual([]);
    resetGearForTest();
  });

  it("swaps the occupied slot when equipping another item", () => {
    resetGearForTest();
    const ringB: GearInstance = { instanceId: "ring-2", definitionId: "sapphire-ring-basic", affixes: [] };
    mutateGearForTest((gear) => gear.initialize(knightInventories(ring, ringB), createEmptyGearLoadouts()));
    mutateGearForTest((gear) => gear.equip("knight", "left-accessory", ring));
    mutateGearForTest((gear) => gear.equip("knight", "left-accessory", ringB));
    expect(readGearState(defaultGameSession).loadouts.knight["left-accessory"]).toBe("ring-2");
    resetGearForTest();
  });

  it("reports armory lock state from inventory and trinkets", () => {
    resetGearForTest();
    expect(readHasAnyOwnedGear(defaultGameSession)).toBe(false);
    mutateGearForTest((gear) => gear.addInstance(armor, "knight"));
    expect(readHasAnyOwnedGear(defaultGameSession)).toBe(true);
    resetGearForTest();
    mutateGearForTest((gear) => gear.addInstance(armor, "wildcard"));
    expect(readHasAnyOwnedGear(defaultGameSession)).toBe(true);
    resetGearForTest();
    expect(readHasAnyOwnedGear(defaultGameSession)).toBe(false);
    mutateGearForTest((gear) => gear.addTrinket("bone-charm"));
    expect(readHasAnyOwnedGear(defaultGameSession)).toBe(true);
    resetGearForTest();
  });

  it("owns one permanent copy and moves it exclusively between character loadouts", () => {
    resetGearForTest();
    expect(mutateGearForTest((gear) => gear.addTrinket("bone-charm"))).toBe(true);
    expect(mutateGearForTest((gear) => gear.addTrinket("bone-charm"))).toBe(false);
    expect(readGearState(defaultGameSession).ownedTrinketIds).toEqual(["bone-charm"]);

    expect(mutateGearForTest((gear) => gear.equipTrinket("knight", "bone-charm"))).toBe(true);
    expect(readGearState(defaultGameSession).equippedTrinkets.knight).toBe("bone-charm");
    expect(mutateGearForTest((gear) => gear.equipTrinket("rogue", "bone-charm"))).toBe(true);
    expect(readGearState(defaultGameSession).equippedTrinkets.knight).toBeNull();
    expect(readGearState(defaultGameSession).equippedTrinkets.rogue).toBe("bone-charm");
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

    dispatchGearMutationWithRunHealthSync(
      {
        mutate: (gear) => gear.addInstance(unique, "knight"),
      },
      defaultGameSession,
    );
    expect(readProfileStore(defaultGameSession).discoveredUniqueIds).toEqual(["wardbreaker"]);

    dispatchGearSalvageWithMaterialGrant((gear) => gear.salvage(unique.instanceId), defaultGameSession);
    expect(flattenGearInventories(readGearState(defaultGameSession).inventories)).toEqual([]);
    expect(readProfileStore(defaultGameSession).discoveredUniqueIds).toEqual(["wardbreaker"]);
    resetGearForTest();
  });

  it("prunes dangling loadouts, unknown trinkets, and duplicate equips on hydrate", () => {
    resetGearForTest();
    const loadouts = createEmptyGearLoadouts();
    loadouts.knight["left-accessory"] = "missing-ring";
    dispatchGameplayCommand(
      (draft) =>
        acceptCommand(
          gearPersistenceCodec.hydrate(
            {
              gearInventories: createEmptyGearInventories(),
              gearLoadouts: loadouts,
              ownedTrinketIds: ["bone-charm", "bogus-trinket"],
              equippedTrinkets: { ...createEmptyEquippedTrinkets(), knight: "bone-charm", rogue: "bone-charm" },
              craftingCurrencies: { ...EMPTY_CRAFTING_CURRENCIES },
            },
            draft,
          ),
        ),
      undefined,
      defaultGameSession,
    );

    expect(readGearState(defaultGameSession).loadouts.knight["left-accessory"]).toBeNull();
    expect(readGearState(defaultGameSession).ownedTrinketIds).toEqual(["bone-charm"]);
    expect(readGearState(defaultGameSession).equippedTrinkets.knight).toBe("bone-charm");
    expect(readGearState(defaultGameSession).equippedTrinkets.rogue).toBeNull();
    resetGearForTest();
  });
});
