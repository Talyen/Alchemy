// Labyrinth configuration constants.
import type { LabyrinthNodeType } from "../types";

export const NODE_TYPE_LABELS: Record<LabyrinthNodeType, string> = {
  combat: "Combat",
  elite: "Elite",
  treasure: "Treasure",
  rest: "Rest",
  mystery: "Mystery",
  shop: "Merchant",
  alchemist: "Alchemist",
  boss: "Boss",
};

export const LABYRINTH_ROWS = 5;
export const LABYRINTH_COLS = 5;
