// Shared type contracts for Labyrinth and Wildwood content systems.
// Used by run controllers, map generation, modifiers, and screens.
import type { EncounterCombatTraitId, EncounterRewardTraitId } from "./encounter-traits";

export { CONTENT_SYSTEMS, CONTENT_SYSTEM_IDS, type ContentSystemId } from "./content-system-ids";
export type { EncounterCombatTraitId, EncounterRewardTraitId, EncounterTraitId } from "./encounter-traits";

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
// No separate entry type — display data comes from the compendium.
// Gauntlet eligibility is the explicit allowlist in wildwood/bosses.ts.
