// Shared type contracts for Labyrinth and Wildwood content systems.
// Used by run controllers, map generation, modifiers, and screens.

export type ContentSystemId = "campaign" | "labyrinth" | "wildwood";

// ============ Labyrinth ============

export type LabyrinthNodeType = "entrance" | "combat" | "elite" | "rest" | "mystery" | "shop" | "alchemist" | "boss";

import type { EncounterCombatTraitId, EncounterRewardTraitId, EncounterTraitId } from "./encounter-traits";

/** @deprecated Prefer category-specific encounter trait IDs. */
export type LabyrinthModifierKind = EncounterTraitId;

type LabyrinthNodeState = "hidden" | "visible" | "current" | "cleared" | "failed";

export type LabyrinthNode = {
  type: LabyrinthNodeType;
  modifiers: EncounterCombatTraitId[];
  rewardModifiers: EncounterRewardTraitId[];
  connections: { row: number; col: number }[];
  state: LabyrinthNodeState;
  enemyId?: string;
};

export type LabyrinthMap = {
  grid: (LabyrinthNode | null)[][];
  rows: number;
  cols: number;
  currentNode: { row: number; col: number };
};

// ============ Wildwood ============
// No separate entry type — display data comes from compendium.
