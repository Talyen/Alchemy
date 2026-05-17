// Shared type contracts for Labyrinth and Wildwood content systems.
// Used by run controllers, map generation, modifiers, and screens.

export type ContentSystemId = "campaign" | "labyrinth" | "wildwood";

// ============ Labyrinth ============

export type LabyrinthNodeType = "entrance" | "combat" | "elite" | "rest" | "mystery" | "shop" | "alchemist" | "boss";

export type LabyrinthModifierKind =
  | "armored"
  | "sturdy"
  | "burning-ground"
  | "overwhelming"
  | "leeching"
  | "null-field"
  | "collector"
  | "generous"
  | "alchemist"
  | "scavenger"
  | "companion";

export type LabyrinthModifier = {
  kind: LabyrinthModifierKind;
  label: string;
  description: string;
};

export type LabyrinthNodeState = "hidden" | "visible" | "current" | "cleared" | "failed";

export type LabyrinthNode = {
  type: LabyrinthNodeType;
  modifiers: LabyrinthModifierKind[];
  rewardModifiers: LabyrinthModifierKind[];
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

export type WildwoodBossEntry = {
  bossId: string;
  title: string;
  subtitle: string;
  descriptionLines: string[];
};
