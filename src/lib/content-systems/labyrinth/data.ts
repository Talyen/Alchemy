/**
 * Labyrinth labels, identity constants, and floor-generation knobs.
 */
import type { LabyrinthNodeType } from "../types";

export const NODE_TYPE_LABELS: Record<LabyrinthNodeType, string> = {
  entrance: "Entrance",
  combat: "Combat",
  elite: "Elite",
  rest: "Rest",
  mystery: "Mystery",
  shop: "Cards",
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

export const LABYRINTH_ENTRANCE_NODE_ID = "labyrinth-entrance";
export const LABYRINTH_ENTRANCE_FLOOR_ID = "labyrinth-floor-0";

export const LABYRINTH_SUPPORT_TYPES: Array<Exclude<LabyrinthNodeType, "entrance" | "combat" | "elite" | "boss">> = [
  "rest",
  "mystery",
  "shop",
  "alchemist",
  "trinket-shop",
  "equipment-shop",
];

export function labyrinthFloorId(depth: number): string {
  return `labyrinth-floor-${depth}`;
}

export function labyrinthNodeId(depth: number, index: number): string {
  return `${labyrinthFloorId(depth)}-n${index}`;
}
