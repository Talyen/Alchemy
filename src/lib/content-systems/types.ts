// Shared type contracts for Labyrinth and Wildwood content systems.
// Used by run controllers, map generation, modifiers, and screens.

export type ContentSystemId = "campaign" | "labyrinth" | "wildwood";

// ============ Labyrinth ============

export type LabyrinthNodeType =
  | "entrance"
  | "combat"
  | "elite"
  | "rest"
  | "mystery"
  | "shop"
  | "alchemist"
  | "trinket-shop"
  | "equipment-shop"
  | "boss";

import type { EncounterCombatTraitId, EncounterRewardTraitId, EncounterTraitId } from "./encounter-trait-ids";

export type { EncounterCombatTraitId, EncounterRewardTraitId, EncounterTraitId };

type LabyrinthNodeState = "hidden" | "visible" | "current" | "cleared" | "failed";

export interface LabyrinthNode {
  type: LabyrinthNodeType;
  modifiers: EncounterCombatTraitId[];
  rewardModifiers: EncounterRewardTraitId[];
  connections: Array<{ row: number; col: number }>;
  state: LabyrinthNodeState;
  enemyId?: string;
}

export interface LabyrinthMap {
  grid: Array<Array<LabyrinthNode | null>>;
  rows: number;
  cols: number;
  currentNode: { row: number; col: number };
}

// ============ Wildwood ============
// No separate entry type — display data comes from compendium.
