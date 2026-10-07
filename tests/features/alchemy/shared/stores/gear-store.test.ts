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
import { acceptCommand, dispatchGameplayCommand } from "@/features/alchemy/shared/stores/gameplay-command";
import { gearPersistenceCodec, readGearState, readHasAnyOwnedGear } from "@/features/alchemy/shared/stores/gear-store";
import { readProfileStore } from "@/features/alchemy/shared/stores/profile-store";
import {
  dispatchGearMutationWithRunHealthSync,
  dispatchGearSalvageWithMaterialGrant,
} from "@/features/alchemy/shared/stores/gear-session-command";
import { defaultGameSession } from "@/app/application-session";

describe("gear-store", () => {
  const armor: GearInstance = { instanceId: "armor-1", definitionId: "leather-armor-basic", affixes: [] };

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
