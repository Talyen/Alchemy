/**
 * Labyrinth configuration constants and labels.
 * Depends on: src/lib/content-systems/types.ts
 * Depended on by: map-generation.ts, use-labyrinth-controller.ts, labyrinth-map-screen.tsx
 */
import type { LabyrinthNodeType } from "../types";

export const NODE_TYPE_LABELS: Record<LabyrinthNodeType, string> = {
  entrance: "Entrance",
  combat: "Combat",
  elite: "Elite",
  rest: "Rest",
  mystery: "Mystery",
  shop: "Merchant",
  alchemist: "Alchemist",
  "trinket-shop": "Trinkets",
  "equipment-shop": "Equipment",
  boss: "Boss",
};

export const NODE_TYPE_TOOLTIPS: Record<LabyrinthNodeType, string> = {
  entrance: "Where this descent began",
  combat: "Fight a standard enemy encounter",
  elite: "Face a stronger foe with extra danger",
  rest: "Recover before pressing deeper",
  mystery: "Encounter an unpredictable event",
  shop: "Spend gold on cards and services",
  alchemist: "Buy or mix potions",
  "trinket-shop": "Buy trinkets for your run",
  "equipment-shop": "Buy gear for your armory",
  boss: "Challenge the Labyrinth guardian",
};

export const LABYRINTH_ROWS = 8;
export const LABYRINTH_COLS = 9;

export const LABYRINTH_START_COL = Math.floor(LABYRINTH_COLS / 2);
export const LABYRINTH_START_ROW = 0;
export const LABYRINTH_BOSS_ROW = LABYRINTH_ROWS - 1;

export interface LabyrinthPoint {
  row: number;
  col: number;
}

export const LABYRINTH_MAP_CONFIG = {
  minBossPathNodes: 11,
  maxNodeDegree: 3,
  upperRowBand: { min: 1, max: 3, combatPct: 0.55, elitePct: 0.2 },
  lowerRowBand: { min: 4, max: 6, combatPct: 0.35, elitePct: 0.3 },
  detourPaths: [
    [
      { row: 1, col: 3 },
      { row: 1, col: 2 },
      { row: 2, col: 2 },
      { row: 2, col: 3 },
    ],
    [
      { row: 1, col: 2 },
      { row: 1, col: 1 },
      { row: 2, col: 1 },
      { row: 3, col: 1 },
      { row: 3, col: 2 },
      { row: 2, col: 2 },
    ],
    [
      { row: 2, col: 4 },
      { row: 2, col: 5 },
      { row: 2, col: 6 },
      { row: 3, col: 6 },
      { row: 3, col: 5 },
    ],
    [
      { row: 2, col: 6 },
      { row: 2, col: 7 },
      { row: 3, col: 7 },
      { row: 4, col: 7 },
      { row: 4, col: 6 },
      { row: 3, col: 6 },
    ],
    [
      { row: 4, col: 5 },
      { row: 4, col: 6 },
      { row: 5, col: 6 },
      { row: 5, col: 5 },
      { row: 5, col: 4 },
    ],
    [
      { row: 5, col: 6 },
      { row: 5, col: 7 },
      { row: 6, col: 7 },
      { row: 6, col: 6 },
      { row: 6, col: 5 },
      { row: 6, col: 4 },
    ],
    [
      { row: 5, col: 3 },
      { row: 5, col: 2 },
      { row: 6, col: 2 },
      { row: 6, col: 3 },
    ],
    [
      { row: 5, col: 2 },
      { row: 5, col: 1 },
      { row: 6, col: 1 },
      { row: 6, col: 2 },
    ],
  ],
} as const;
