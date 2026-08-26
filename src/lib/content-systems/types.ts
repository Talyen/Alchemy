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

/** Derived map chrome. Persisted nodes store `cleared` only. */
export type LabyrinthNodeVisualState = "locked" | "reachable" | "cleared";

export interface LabyrinthGridPosition {
  row: number;
  col: number;
}

export interface LabyrinthNode {
  id: string;
  type: LabyrinthNodeType;
  floor: number;
  gridPosition: LabyrinthGridPosition;
  modifiers: EncounterCombatTraitId[];
  rewardModifiers: EncounterRewardTraitId[];
  /** Cross-floor links only. Same-floor travel is hex adjacency. */
  outgoingIds: string[];
  cleared: boolean;
  enemyId?: string;
}

export interface LabyrinthFloor {
  id: string;
  depth: number;
  nodeIds: string[];
}

export interface LabyrinthMap {
  floors: LabyrinthFloor[];
  nodes: Record<string, LabyrinthNode>;
  currentFloor: number;
}

// ============ Wildwood ============
// No separate entry type — display data comes from the compendium.
// Gauntlet eligibility is the explicit allowlist in wildwood/bosses.ts.
