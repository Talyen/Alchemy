// Labyrinth configuration constants.
import type { LabyrinthNodeType } from "../types";

export const NODE_TYPE_LABELS: Record<LabyrinthNodeType, string> = {
  entrance: "Entrance",
  combat: "Combat",
  elite: "Elite",
  rest: "Rest",
  mystery: "Mystery",
  shop: "Merchant",
  alchemist: "Alchemist",
  boss: "Boss",
};

export const LABYRINTH_ROWS = 8;
export const LABYRINTH_COLS = 9;
