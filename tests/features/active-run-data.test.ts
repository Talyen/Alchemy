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
    });
  });
});
