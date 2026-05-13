// Active-run save migration helpers for legacy or partial localStorage payloads.
// Depends on current character/card data and the persisted active-run contract.
import { getStartingDeck, type BattleCard, type CharacterId } from "@/lib/game-data";

import type { ActiveRunData } from "../run/types";

type PersistedRunCandidate = Record<string, unknown> & {
  runDeck: unknown[];
  runGold: number;
  runPlayerHealth: number;
  runMaxHealth: number;
  roomsEncountered: number;
  currentAct: number;
  destinationIndexInAct: number;
  completedDestinations: unknown[];
  runTrinkets: unknown[];
};

const legacyStarterDeckIds = ["slash", "bash", "block", "anvil", "plate-mail", "apple", "meteor", "blessed-aegis"];

// Character IDs are persisted, so renamed or invalid IDs need explicit guarding before hydration.
function isValidCharacterId(id: string): id is CharacterId {
  return id === "knight" || id === "ranger" || id === "rogue" || id === "wizard";
}

// Active-run snapshots must include real run fields; a lone characterId is only a
// default/legacy fragment and should not make the main menu offer Resume Run.
function hasPersistedRunShape(candidate: Record<string, unknown>): candidate is PersistedRunCandidate {
  return (
    Array.isArray(candidate.runDeck) &&
    typeof candidate.runGold === "number" &&
    typeof candidate.runPlayerHealth === "number" &&
    typeof candidate.runMaxHealth === "number" &&
    typeof candidate.roomsEncountered === "number" &&
    typeof candidate.currentAct === "number" &&
    typeof candidate.destinationIndexInAct === "number" &&
    Array.isArray(candidate.completedDestinations) &&
    Array.isArray(candidate.runTrinkets)
  );
}

// Deck comparison uses IDs because saves store card objects whose other fields may be stale.
function deckIdsMatch(deck: unknown[], ids: string[]): boolean {
  return (
    deck.length === ids.length &&
    deck.every((card, index) => typeof card === "object" && card !== null && (card as BattleCard).id === ids[index])
  );
}

// Only unstarted active-run snapshots are safe to repair without deleting legitimate run progress.
function isUnstartedRun(candidate: PersistedRunCandidate): boolean {
  return (
    candidate.roomsEncountered === 0 &&
    candidate.currentAct === 1 &&
    candidate.destinationIndexInAct === 0 &&
    candidate.completedDestinations.length === 0
  );
}

// Active runs are sanitized before hydration because localStorage can contain stale
// character IDs, renamed heroes, missing route fields, or hand-edited invalid payloads.
export function normalizeActiveRun(activeRun: unknown): ActiveRunData | null {
  if (!activeRun || typeof activeRun !== "object") {
    return null;
  }

  const candidate = activeRun as Record<string, unknown>;
  const rawCharacterId =
    candidate.characterId === "sorcerer"
      ? "wizard"
      : candidate.characterId === "warden"
        ? "ranger"
        : candidate.characterId;
  const characterId = typeof rawCharacterId === "string" && isValidCharacterId(rawCharacterId) ? rawCharacterId : null;
  if (!characterId) {
    return null;
  }

  if (!hasPersistedRunShape(candidate)) {
    return null;
  }

  const shouldUseClassDeck =
    candidate.runDeck.length === 0 ||
    (isUnstartedRun(candidate) && deckIdsMatch(candidate.runDeck, legacyStarterDeckIds));
  const runDeck = shouldUseClassDeck ? getStartingDeck(characterId) : (candidate.runDeck as BattleCard[]);

  return {
    characterId,
    runDeck,
    runGold: candidate.runGold,
    runPlayerHealth: candidate.runPlayerHealth,
    runMaxHealth: candidate.runMaxHealth,
    roomsEncountered: candidate.roomsEncountered,
    currentAct: candidate.currentAct,
    destinationIndexInAct: candidate.destinationIndexInAct,
    completedDestinations: candidate.completedDestinations as string[],
    runTrinkets: candidate.runTrinkets as string[],
  };
}
