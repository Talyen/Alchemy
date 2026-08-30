import type { EncounterCombatTraitId, EncounterRewardTraitId } from "./encounter-traits";

export { CONTENT_SYSTEMS, CONTENT_SYSTEM_IDS, type ContentSystemId } from "./content-system-ids";
export type { EncounterCombatTraitId, EncounterRewardTraitId, EncounterTraitId } from "./encounter-traits";
export { WILDWOOD_BOSS_IDS, type WildwoodBossId } from "./wildwood/bosses";
export type { WildwoodDraftState, WildwoodModifierId } from "./wildwood/gauntlet";

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
