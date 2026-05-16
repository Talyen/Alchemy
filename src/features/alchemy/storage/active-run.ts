// Active-run save migration helpers for legacy or partial localStorage payloads.
// Depends on current character/card data and the persisted active-run contract.
import { cardLibrary, getStartingDeck, type BattleCard, type CharacterId, type DifficultyId } from "@/lib/game-data";
import type { LabyrinthMap, LabyrinthNode, LabyrinthNodeState, LabyrinthNodeType } from "@/lib/content-systems/types";

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
  selectedDifficulty?: unknown;
};

const VALID_DIFFICULTY_IDS = ["difficulty-1", "difficulty-2", "difficulty-3"];
const VALID_LABYRINTH_NODE_TYPES = new Set<LabyrinthNodeType>(["combat", "elite", "treasure", "rest", "mystery", "shop", "alchemist", "boss"]);
const VALID_LABYRINTH_NODE_STATES = new Set<LabyrinthNodeState>(["hidden", "visible", "current", "cleared", "failed"]);

function isValidDifficultyId(id: unknown): id is DifficultyId {
  return typeof id === "string" && VALID_DIFFICULTY_IDS.includes(id);
}

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

// Save data owns run-specific card mutations, while library data refreshes build-hashed art assets.
function hydrateSavedCard(savedCard: BattleCard): BattleCard {
  const libraryCard = cardLibrary.find((card) => card.id === savedCard.id);
  if (!libraryCard) return savedCard;
  return { ...libraryCard, ...savedCard, art: libraryCard.art };
}

// Labyrinth maps are persisted mid-run, so corrupt/hand-edited maps are discarded
// instead of partially repaired into impossible traversal state.
function normalizeLabyrinthMap(value: unknown): LabyrinthMap | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (!Array.isArray(candidate.grid)) return null;
  if (typeof candidate.rows !== "number" || typeof candidate.cols !== "number") return null;
  const currentNode = candidate.currentNode as Record<string, unknown> | undefined;
  if (!currentNode || typeof currentNode.row !== "number" || typeof currentNode.col !== "number") return null;

  const grid = candidate.grid.map((row) => {
    if (!Array.isArray(row)) return null;
    return row.map((node) => normalizeLabyrinthNode(node));
  });
  if (grid.some((row) => row === null)) return null;

  const typedGrid = grid as (LabyrinthNode | null)[][];
  if (!typedGrid[currentNode.row]?.[currentNode.col]) return null;

  return {
    grid: typedGrid,
    rows: candidate.rows,
    cols: candidate.cols,
    currentNode: { row: currentNode.row, col: currentNode.col },
  };
}

function normalizeLabyrinthNode(value: unknown): LabyrinthNode | null {
  if (value === null) return null;
  if (!value || typeof value !== "object") return null;
  const node = value as Record<string, unknown>;
  if (typeof node.type !== "string" || !VALID_LABYRINTH_NODE_TYPES.has(node.type as LabyrinthNodeType)) return null;
  if (typeof node.state !== "string" || !VALID_LABYRINTH_NODE_STATES.has(node.state as LabyrinthNodeState)) return null;
  if (!Array.isArray(node.modifiers) || !node.modifiers.every((m) => typeof m === "string")) return null;
  if (!Array.isArray(node.connections)) return null;
  const connections = node.connections.map((conn) => {
    if (!conn || typeof conn !== "object") return null;
    const c = conn as Record<string, unknown>;
    if (typeof c.row !== "number" || typeof c.col !== "number") return null;
    return { row: c.row, col: c.col };
  });
  if (connections.some((conn) => conn === null)) return null;
  return {
    type: node.type as LabyrinthNodeType,
    modifiers: node.modifiers as LabyrinthNode["modifiers"],
    connections: connections as { row: number; col: number }[],
    state: node.state as LabyrinthNodeState,
    ...(typeof node.enemyId === "string" ? { enemyId: node.enemyId } : {}),
  };
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
  const runDeck = shouldUseClassDeck
    ? getStartingDeck(characterId)
    : (candidate.runDeck as BattleCard[]).map(hydrateSavedCard);

  const persistedDifficulty = candidate.selectedDifficulty;
  const selectedDifficulty = isValidDifficultyId(persistedDifficulty) ? persistedDifficulty : null;
  const contentSystemType: "campaign" | "labyrinth" = candidate.contentSystemType === "labyrinth" ? "labyrinth" : "campaign";
  // Wildwood runs are never persisted; only campaign and labyrinth are valid stored values.
  const labyrinthMap = contentSystemType === "labyrinth" ? normalizeLabyrinthMap(candidate.labyrinthMap) : null;

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
    selectedDifficulty,
    contentSystemType,
    labyrinthMap,
  };
}
