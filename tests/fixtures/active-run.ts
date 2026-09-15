import { ActiveRunDataSchema } from "@/lib/validation";

// Fixture roles: makeMinimalActiveRunInput is the base for ad-hoc run payloads,
// makeRunCandidate adds a deck plus progress for storage-level tests,
// baseActiveRunInput pins the selections most schema tests start from, and
// parseActiveRunData parses or throws for repair-focused assertions.
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

export function makeWildwoodDraft(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    phase: "draft",
    draftChoices: [],
    remainingBossIds: [],
    previousBossId: null,
    currentBossId: null,
    currentCombatTraitIds: [],
    currentRewardTraitIds: [],
    ...overrides,
  };
}

export const tombstonedCard = { id: "antivenom-potion" };
export const tombstonedCard2 = { id: "imp-companion" };
export const liveCard = { id: "slash" };

export function parseActiveRunData(overrides: Record<string, unknown> = {}) {
  const result = ActiveRunDataSchema.safeParse({ ...baseActiveRunInput(), ...overrides });
  if (!result.success) throw new Error(result.error.message);
  return result.data;
}
