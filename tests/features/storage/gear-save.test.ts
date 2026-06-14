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

  it("migrates persisted trinket terminology to boons", () => {
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
    expect(save.discoveredBoonIds).toEqual(["bone-charm"]);
    expect(save.activeRun?.runBoons).toEqual(["bone-charm"]);
  });
});
