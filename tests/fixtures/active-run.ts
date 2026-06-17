/** Shared active-run input shapes for storage, parse, and normalization tests. */

/** Minimal valid-ish run input used by ActiveRunDataSchema contract tests. */
export function makeMinimalActiveRunInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    characterId: "knight",
    runDeck: [],
    runGold: 0,
    runPlayerHealth: 30,
    runMaxHealth: 30,
    roomsEncountered: 0,
    currentAct: 1,
    destinationIndexInAct: 0,
    completedDestinations: [],
    runTrinkets: [],
    contentSystemType: "campaign",
    ...overrides,
  };
}

/** Full run candidate for production parseActiveRun tests. */
export function makeRunCandidate(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    characterId: "knight",
    runDeck: [{
      id: "slash",
      title: "Slash",
      descriptionLines: [""],
      art: "",
      cost: 1,
      effects: [{ kind: "damage", damageType: "physical", amount: 4 }],
      uid: 1,
    }],
    runGold: 10,
    runPlayerHealth: 25,
    runMaxHealth: 30,
    roomsEncountered: 2,
    currentAct: 1,
    destinationIndexInAct: 1,
    completedDestinations: ["combat"],
    runTrinkets: [],
    selectedDifficulty: "difficulty-1",
    contentSystemType: "campaign",
    ...overrides,
  };
}

/** Input for normalizeActiveRunData tests. */
export function baseActiveRunInput(): Record<string, unknown> {
  return {
    characterId: "knight",
    runDeck: [],
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
  };
}
