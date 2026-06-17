import { describe, expect, it } from "vitest";
import { normalizeSaveData } from "@/features/alchemy/shared/storage/migrations";

describe("gear save normalization", () => {
  it("defaults old saves to an empty inventory and empty class loadouts", () => {
    const save = normalizeSaveData({ saveSchemaVersion: 3 });
    expect(save.gearInventory).toEqual([]);
    expect(Object.values(save.gearLoadouts).every((loadout) => Object.values(loadout).every((id) => id === null))).toBe(
      true,
    );
  });

  it("discards obsolete Gear trinkets and loadout slots while preserving valid Gear", () => {
    const save = normalizeSaveData({
      saveSchemaVersion: 5,
      gearInventory: [
        { instanceId: "body-1", definitionId: "leather-armor-basic", affixes: [] },
        { instanceId: "old-trinket", definitionId: "placeholder-trinket", affixes: [] },
      ],
      gearLoadouts: {
        knight: { body: "body-1", "trinket-1": "old-trinket" },
      },
    });

    expect(save.gearInventory).toEqual([
      { instanceId: "body-1", definitionId: "leather-armor-basic", affixes: [] },
    ]);
    expect(save.gearLoadouts.knight.body).toBe("body-1");
    expect(save.gearLoadouts.knight).not.toHaveProperty("trinket-1");
  });

  it("keeps only the first loadout reference when legacy saves equip one item multiple times", () => {
    const save = normalizeSaveData({
      saveSchemaVersion: 5,
      gearInventory: [{ instanceId: "ring-1", definitionId: "ruby-ring-basic", affixes: [] }],
      gearLoadouts: {
        knight: { "left-ring": "ring-1" },
        rogue: { "right-ring": "ring-1" },
      },
    });

    expect(save.gearLoadouts.knight["left-ring"]).toBe("ring-1");
    expect(save.gearLoadouts.rogue["right-ring"]).toBeNull();
  });

  it("drops loadout references that are not present in gearInventory", () => {
    const save = normalizeSaveData({
      saveSchemaVersion: 5,
      gearInventory: [{ instanceId: "body-1", definitionId: "leather-armor-basic", affixes: [] }],
      gearLoadouts: {
        knight: { body: "body-1", helm: "missing-helm" },
      },
    });

    expect(save.gearLoadouts.knight.body).toBe("body-1");
    expect(save.gearLoadouts.knight.helm).toBeNull();
  });

  it("normalizes legacy physical modifiers when affix rolls are absent", () => {
    const save = normalizeSaveData({
      saveSchemaVersion: 5,
      gearInventory: [
        {
          instanceId: "body-1",
          definitionId: "leather-armor-basic",
          modifiers: [{ kind: "flatPhysicalDamage", value: 2 }],
        },
      ],
    });

    expect(save.gearInventory[0]?.affixes).toEqual([
      { id: "flat-physical", value: 1 },
      { id: "flat-physical", value: 1 },
    ]);
  });

  it("migrates legacy affix ids and strips invalid entries", () => {
    const save = normalizeSaveData({
      saveSchemaVersion: 5,
      gearInventory: [
        {
          instanceId: "body-1",
          definitionId: "leather-armor-basic",
          affixIds: ["flat-burn-1", "not-an-affix"],
        },
      ],
    });

    expect(save.gearInventory[0]?.affixes).toEqual([{ id: "flat-burn", value: 1 }]);
  });

  it("defaults gear board positions to an empty record", () => {
    const save = normalizeSaveData({ saveSchemaVersion: 5 });
    expect(save.gearBoardPositions).toEqual({});
  });

  it("prunes board positions for items no longer in inventory", () => {
    const save = normalizeSaveData({
      saveSchemaVersion: 5,
      gearInventory: [{ instanceId: "body-1", definitionId: "leather-armor-basic", affixes: [] }],
      gearBoardPositions: {
        "body-1": { col: 2, row: 1 },
        "missing-1": { col: 0, row: 0 },
      },
    });

    expect(save.gearBoardPositions).toEqual({ "body-1": { col: 2, row: 1 } });
  });

  it("migrates persisted legacy trinket field names to trinkets", () => {
    const save = normalizeSaveData({
      saveSchemaVersion: 3,
      discoveredTrinketIds: ["bone-charm"],
      activeRun: {
        characterId: "knight",
        runDeck: [],
        runGold: 0,
        runPlayerHealth: 30,
        runMaxHealth: 30,
        roomsEncountered: 0,
        currentAct: 1,
        destinationIndexInAct: 0,
        completedDestinations: [],
        runTrinkets: ["bone-charm"],
        contentSystemType: "campaign",
      },
    });
    expect(save.discoveredTrinketIds).toEqual(["bone-charm"]);
    expect(save.activeRun?.runTrinkets).toEqual(["bone-charm"]);
  });
});
