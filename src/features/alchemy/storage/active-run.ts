// Active-run save migration helpers for legacy or partial localStorage payloads.
// Depends on current character/card data and the persisted active-run contract.
import { cardLibrary, getStartingDeck, type BattleCard, type CharacterId, type DifficultyId } from "@/lib/game-data";
import type { LabyrinthMap, LabyrinthNode, LabyrinthNodeState, LabyrinthNodeType, LabyrinthModifierKind } from "@/lib/content-systems/types";
import { ALL_LABYRINTH_MODIFIERS } from "@/lib/content-systems/labyrinth/modifiers";

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
const VALID_LABYRINTH_NODE_TYPES = new Set<LabyrinthNodeType>(["entrance", "combat", "elite", "rest", "mystery", "shop", "alchemist", "boss"]);
const VALID_LABYRINTH_NODE_STATES = new Set<LabyrinthNodeState>(["hidden", "visible", "current", "cleared", "failed"]);
const VALID_LABYRINTH_MODIFIER_KINDS = new Set(Object.keys(ALL_LABYRINTH_MODIFIERS) as LabyrinthModifierKind[]);

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

// Modifier definitions can change between builds, so persisted maps drop unknown
// strings rather than letting stale values crash map tooltips after hydration.
function normalizeLabyrinthModifierKinds(value: unknown): LabyrinthModifierKind[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter((m): m is LabyrinthModifierKind => typeof m === "string" && VALID_LABYRINTH_MODIFIER_KINDS.has(m as LabyrinthModifierKind));
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
  for (let row = 0; row < typedGrid.length; row += 1) {
    for (let col = 0; col < (typedGrid[row]?.length ?? 0); col += 1) {
      const node = typedGrid[row]?.[col];
      if (!node) continue;
      if (node.connections.length < 1 || node.connections.length > 3) return null;
      for (const connection of node.connections) {
        const target = typedGrid[connection.row]?.[connection.col];
        if (!target) return null;
        const dr = Math.abs(connection.row - row);
        const dc = Math.abs(connection.col - col);
        if (!((dr === 1 && dc === 0) || (dr === 0 && dc === 1))) return null;
      }
    }
  }

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
  const modifiers = normalizeLabyrinthModifierKinds(node.modifiers);
  if (!modifiers) return null;
  const rewardModifiers = normalizeLabyrinthModifierKinds(node.rewardModifiers) ?? [];
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
    modifiers,
    rewardModifiers,
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
