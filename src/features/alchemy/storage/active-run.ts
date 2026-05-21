// Active-run save migration helpers for legacy or partial localStorage payloads.
// Depends on: game-data (character/card lookup), labyrinth types, game-constants (ACTS_PER_RUN, LEGACY_STARTER_DECK_IDS).
// Used by: storage/io.ts indirectly via SaveDataSchema — and directly by the legacy normalizeSaveData test wrapper.
import {
  cardLibrary,
  characters,
  getStartingDeck,
  type BattleCard,
  type CharacterId,
  type DifficultyId,
} from "@/lib/game-data";
import type {
  LabyrinthMap,
  LabyrinthNode,
  LabyrinthNodeState,
  LabyrinthNodeType,
  LabyrinthModifierKind,
} from "@/lib/content-systems/types";
import { defaultBattleState, type BattleState } from "@/lib/battle";
import { ALL_LABYRINTH_MODIFIERS } from "@/lib/content-systems/labyrinth/modifiers";
import { ACTS_PER_RUN, LEGACY_STARTER_DECK_IDS } from "@/lib/game-constants";

import type { ActiveRunData } from "../run/types";
import type { ActiveCombatData, LabyrinthNodePosition } from "../run/types";

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
  encounteredRunEnemyIds?: unknown;
  selectedDifficulty?: unknown;
  activeCombat?: unknown;
};

const VALID_DIFFICULTY_IDS = ["difficulty-1", "difficulty-2", "difficulty-3"];
const VALID_LABYRINTH_NODE_TYPES = new Set<LabyrinthNodeType>([
  "entrance",
  "combat",
  "elite",
  "rest",
  "mystery",
  "shop",
  "alchemist",
  "boss",
]);
const VALID_LABYRINTH_NODE_STATES = new Set<LabyrinthNodeState>(["hidden", "visible", "current", "cleared", "failed"]);
const VALID_LABYRINTH_MODIFIER_KINDS = new Set(Object.keys(ALL_LABYRINTH_MODIFIERS) as LabyrinthModifierKind[]);

function isValidDifficultyId(id: unknown): id is DifficultyId {
  return typeof id === "string" && VALID_DIFFICULTY_IDS.includes(id);
}

// Derived from the live characters map — adding a new character automatically makes its saves valid.
const VALID_CHARACTER_IDS = new Set(Object.keys(characters) as CharacterId[]);

// Character IDs are persisted, so renamed or invalid IDs need explicit guarding before hydration.
function isValidCharacterId(id: string): id is CharacterId {
  return VALID_CHARACTER_IDS.has(id as CharacterId);
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

// Run counters and resources must be finite integers before React hydrates them.
function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

// Acts are bounded by the campaign rules; labyrinth uses act 1 but shares the field.
function isValidAct(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= ACTS_PER_RUN
  );
}

// Active runs can be saved at low health, but max Health must remain a positive finite cap.
function hasValidHealth(playerHealth: unknown, maxHealth: unknown): playerHealth is number {
  return (
    typeof playerHealth === "number" &&
    typeof maxHealth === "number" &&
    Number.isFinite(playerHealth) &&
    Number.isFinite(maxHealth) &&
    Number.isInteger(playerHealth) &&
    Number.isInteger(maxHealth) &&
    maxHealth > 0 &&
    playerHealth >= 0 &&
    playerHealth <= maxHealth
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

// Save data owns only run-specific card mutations, while library data owns identity, title, and art.
function hydrateSavedCard(savedCard: BattleCard): BattleCard {
  const libraryCard = cardLibrary.find((card) => card.id === savedCard.id);
  if (!libraryCard) return savedCard;
  const nextCard: BattleCard = {
    ...libraryCard,
    descriptionLines: [...libraryCard.descriptionLines],
    effects: libraryCard.effects.map((effect) => ({ ...effect })),
  };

  if (typeof savedCard.uid === "number" && Number.isInteger(savedCard.uid)) nextCard.uid = savedCard.uid;
  if (typeof savedCard.cost === "number" && Number.isFinite(savedCard.cost) && savedCard.cost >= 0)
    nextCard.cost = Math.floor(savedCard.cost);
  if (typeof savedCard.consume === "boolean") nextCard.consume = savedCard.consume;
  if (typeof savedCard.corrupted === "boolean") nextCard.corrupted = savedCard.corrupted;
  if (typeof savedCard.baseTitle === "string") nextCard.baseTitle = savedCard.baseTitle;
  if (
    Array.isArray(savedCard.descriptionLines) &&
    savedCard.descriptionLines.every((line) => typeof line === "string")
  ) {
    nextCard.descriptionLines = [...savedCard.descriptionLines];
  }
  if (Array.isArray(savedCard.effects) && savedCard.effects.every((effect) => effect && typeof effect === "object")) {
    nextCard.effects = savedCard.effects.map((effect) => ({ ...effect }));
  }
  if (Array.isArray(savedCard.corruptedValuePositions)) {
    const positions = savedCard.corruptedValuePositions.filter(
      (position) =>
        position &&
        typeof position === "object" &&
        Number.isInteger(position.lineIndex) &&
        Number.isInteger(position.matchIndex) &&
        position.lineIndex >= 0 &&
        position.matchIndex >= 0,
    );
    if (positions.length > 0) nextCard.corruptedValuePositions = positions;
  }

  return nextCard;
}

// Modifier definitions can change between builds, so persisted maps drop unknown
// strings rather than letting stale values crash map tooltips after hydration.
function normalizeLabyrinthModifierKinds(value: unknown): LabyrinthModifierKind[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter(
    (m): m is LabyrinthModifierKind =>
      typeof m === "string" && VALID_LABYRINTH_MODIFIER_KINDS.has(m as LabyrinthModifierKind),
  );
}

// Labyrinth maps are persisted mid-run, so corrupt/hand-edited maps are discarded
// instead of partially repaired into impossible traversal state.
function normalizeLabyrinthMap(value: unknown): LabyrinthMap | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (!Array.isArray(candidate.grid)) return null;
  if (!isNonNegativeInteger(candidate.rows) || !isNonNegativeInteger(candidate.cols)) return null;
  if (candidate.rows <= 0 || candidate.cols <= 0) return null;
  if (candidate.grid.length !== candidate.rows) return null;
  const currentNode = candidate.currentNode as Record<string, unknown> | undefined;
  if (!currentNode || !isNonNegativeInteger(currentNode.row) || !isNonNegativeInteger(currentNode.col)) return null;
  if (currentNode.row >= candidate.rows || currentNode.col >= candidate.cols) return null;

  const grid = candidate.grid.map((row) => {
    if (!Array.isArray(row)) return null;
    if (row.length !== candidate.cols) return null;
    return row.map((node) => normalizeLabyrinthNode(node));
  });
  if (grid.some((row) => row === null)) return null;

  const typedGrid = grid as (LabyrinthNode | null)[][];
  if (!typedGrid[currentNode.row]?.[currentNode.col]) return null;
  let currentCount = 0;
  let entranceCount = 0;
  let bossCount = 0;
  for (let row = 0; row < typedGrid.length; row += 1) {
    for (let col = 0; col < (typedGrid[row]?.length ?? 0); col += 1) {
      const node = typedGrid[row]?.[col];
      if (!node) continue;
      if (node.type === "entrance") entranceCount += 1;
      if (node.type === "boss") bossCount += 1;
      if (node.state === "current") {
        currentCount += 1;
        if (currentNode.row !== row || currentNode.col !== col) return null;
      }
      if (node.connections.length < 1 || node.connections.length > 3) return null;
      for (const connection of node.connections) {
        const target = typedGrid[connection.row]?.[connection.col];
        if (!isNonNegativeInteger(connection.row) || !isNonNegativeInteger(connection.col)) return null;
        if (connection.row >= candidate.rows || connection.col >= candidate.cols) return null;
        if (!target) return null;
        const dr = Math.abs(connection.row - row);
        const dc = Math.abs(connection.col - col);
        if (!((dr === 1 && dc === 0) || (dr === 0 && dc === 1))) return null;
      }
    }
  }
  if (currentCount !== 1 || entranceCount !== 1 || bossCount !== 1) return null;

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
    if (!isNonNegativeInteger(c.row) || !isNonNegativeInteger(c.col)) return null;
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

function normalizeLabyrinthPosition(value: unknown): LabyrinthNodePosition | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (!isNonNegativeInteger(candidate.row) || !isNonNegativeInteger(candidate.col)) return null;
  return { row: candidate.row, col: candidate.col };
}

export function isPersistedBattleState(value: unknown): value is BattleState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<BattleState>;
  return (
    Array.isArray(state.deck) &&
    Array.isArray(state.hand) &&
    Array.isArray(state.discard) &&
    Array.isArray(state.exhausted) &&
    typeof state.mana === "number" &&
    typeof state.maxMana === "number" &&
    typeof state.gold === "number" &&
    typeof state.turn === "number" &&
    (state.turnPhase === "player" || state.turnPhase === "enemy") &&
    typeof state.playerHealth === "number" &&
    typeof state.playerMaxHealth === "number" &&
    typeof state.enemyHealth === "number" &&
    typeof state.enemyMaxHealth === "number" &&
    Boolean(state.currentEnemy) &&
    typeof state.currentEnemy === "object" &&
    Array.isArray(state.enemyAttackEffects) &&
    Boolean(state.playerStatuses) &&
    Boolean(state.enemyStatuses) &&
    Boolean(state.flags) &&
    Array.isArray(state.discoveredCardIds) &&
    Array.isArray(state.difficultyModifiers)
  );
}

function normalizeActiveCombat(value: unknown, contentSystemType: "campaign" | "labyrinth"): ActiveCombatData | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (!isPersistedBattleState(candidate.battleState)) return null;
  return {
    battleState: { ...defaultBattleState(), ...(candidate.battleState as Partial<BattleState>) } as BattleState,
    activeLabyrinthModifiers:
      contentSystemType === "labyrinth"
        ? (normalizeLabyrinthModifierKinds(candidate.activeLabyrinthModifiers) ?? [])
        : [],
    activeLabyrinthRewardModifiers:
      contentSystemType === "labyrinth"
        ? (normalizeLabyrinthModifierKinds(candidate.activeLabyrinthRewardModifiers) ?? [])
        : [],
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

  if (
    !isNonNegativeInteger(candidate.runGold) ||
    !hasValidHealth(candidate.runPlayerHealth, candidate.runMaxHealth) ||
    !isNonNegativeInteger(candidate.roomsEncountered) ||
    !isValidAct(candidate.currentAct) ||
    !isNonNegativeInteger(candidate.destinationIndexInAct)
  ) {
    return null;
  }

  const shouldUseClassDeck =
    candidate.runDeck.length === 0 ||
    (isUnstartedRun(candidate) && deckIdsMatch(candidate.runDeck, [...LEGACY_STARTER_DECK_IDS]));
  const runDeck = shouldUseClassDeck
    ? getStartingDeck(characterId)
    : (candidate.runDeck as BattleCard[]).map(hydrateSavedCard);

  const persistedDifficulty = candidate.selectedDifficulty;
  const selectedDifficulty = isValidDifficultyId(persistedDifficulty) ? persistedDifficulty : null;
  const contentSystemType: "campaign" | "labyrinth" =
    candidate.contentSystemType === "labyrinth" ? "labyrinth" : "campaign";
  // Wildwood runs are never persisted; only campaign and labyrinth are valid stored values.
  const labyrinthMap = contentSystemType === "labyrinth" ? normalizeLabyrinthMap(candidate.labyrinthMap) : null;
  const activeCombat = normalizeActiveCombat(candidate.activeCombat, contentSystemType);

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
    encounteredRunEnemyIds: Array.isArray(candidate.encounteredRunEnemyIds)
      ? [...new Set(candidate.encounteredRunEnemyIds.filter((id): id is string => typeof id === "string"))]
      : [],
    selectedDifficulty,
    contentSystemType,
    labyrinthMap,
    labyrinthPendingNode:
      contentSystemType === "labyrinth" ? normalizeLabyrinthPosition(candidate.labyrinthPendingNode) : null,
    activeCombat,
  };
}
