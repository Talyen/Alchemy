import { describe, expect, it } from "vitest";

import { getStartingDeck } from "@/lib/game-data";
import { createActiveRunData } from "@/features/alchemy/run/active-run-data";

describe("createActiveRunData", () => {
  it("copies only persisted active-run fields", () => {
    const runDeck = getStartingDeck("knight");
    const result = createActiveRunData({
      characterId: "knight",
      runDeck,
      runGold: 42,
      runPlayerHealth: 18,
      runMaxHealth: 32,
      roomsEncountered: 4,
      currentAct: 2,
      destinationIndexInAct: 1,
      completedDestinations: ["Normal Combat", "Campfire"],
      runTrinkets: ["bone-charm"],
      selectedDifficulty: null,
      contentSystemType: "campaign",
      labyrinthMap: null,
    });

    expect(result).toEqual({
      characterId: "knight",
      runDeck,
      runGold: 42,
      runPlayerHealth: 18,
      runMaxHealth: 32,
      roomsEncountered: 4,
      currentAct: 2,
      destinationIndexInAct: 1,
      completedDestinations: ["Normal Combat", "Campfire"],
      runTrinkets: ["bone-charm"],
      selectedDifficulty: null,
      contentSystemType: "campaign",
      labyrinthMap: null,
    });
  });

  it("includes contentSystemType field defaulting to campaign", () => {
    const runDeck = getStartingDeck("knight");
    const result = createActiveRunData({
      characterId: "knight",
      runDeck,
      runGold: 0,
      runPlayerHealth: 30,
      runMaxHealth: 30,
      roomsEncountered: 0,
      currentAct: 1,
      destinationIndexInAct: 0,
      completedDestinations: [],
      runTrinkets: [],
      selectedDifficulty: null,
      contentSystemType: "campaign",
      labyrinthMap: null,
    });
    expect(result.contentSystemType).toBe("campaign");
  });

  it("can set contentSystemType to labyrinth", () => {
    const runDeck = getStartingDeck("knight");
    const result = createActiveRunData({
      characterId: "knight",
      runDeck,
      runGold: 0,
      runPlayerHealth: 30,
      runMaxHealth: 30,
      roomsEncountered: 0,
      currentAct: 1,
      destinationIndexInAct: 0,
      completedDestinations: [],
      runTrinkets: [],
      selectedDifficulty: null,
      contentSystemType: "labyrinth",
      labyrinthMap: null,
    });
    expect(result.contentSystemType).toBe("labyrinth");
  });
});
