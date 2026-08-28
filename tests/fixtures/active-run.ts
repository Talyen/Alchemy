const BASE_RUN_TEMPLATE = {
  characterId: "knight",
  runDeck: [],
  runPlayerHealth: 30,
  runMaxHealth: 30,
  roomsEncountered: 0,
  currentAct: 1,
  destinationIndexInAct: 0,
  completedDestinations: [],
  runBoons: [],
  contentSystemType: "campaign",
} as const;

export function makeMinimalActiveRunInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...BASE_RUN_TEMPLATE,
    completedDestinations: [],
    runDeck: [],
    runBoons: [],
    ...overrides,
  };
}

export function makeRunCandidate(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return makeMinimalActiveRunInput({
    runDeck: [
      {
        id: "slash",
        title: "Slash",
        descriptionLines: [""],
        art: "",
        cost: 1,
        effects: [{ kind: "damage", damageType: "physical", amount: 4 }],
        uid: 1,
      },
    ],
    runPlayerHealth: 25,
    roomsEncountered: 2,
    destinationIndexInAct: 1,
    completedDestinations: ["combat"],
    selectedDifficulty: "difficulty-1",
    ...overrides,
  });
}

export function baseActiveRunInput(): Record<string, unknown> {
  return makeMinimalActiveRunInput({
    selectedDifficulty: null,
    labyrinthMap: null,
  });
}
