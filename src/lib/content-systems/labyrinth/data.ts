import type { LabyrinthNodeType } from "../types";
import { DESTINATIONS, type Destination } from "@/lib/routing/destinations";

export const LABYRINTH_TYPE_TO_DESTINATION: Record<LabyrinthNodeType, Destination> = {
  entrance: DESTINATIONS.NORMAL_COMBAT,
  combat: DESTINATIONS.NORMAL_COMBAT,
  elite: DESTINATIONS.ELITE_COMBAT,
  boss: DESTINATIONS.BOSS_COMBAT,
  rest: DESTINATIONS.CAMPFIRE,
  mystery: DESTINATIONS.MYSTERY,
  shop: DESTINATIONS.CARD_SHOP,
  alchemist: DESTINATIONS.ALCHEMIST_SHOP,
  "trinket-shop": DESTINATIONS.TRINKET_SHOP,
  "equipment-shop": DESTINATIONS.EQUIPMENT_SHOP,
};

export const NODE_TYPE_LABELS: Record<LabyrinthNodeType, string> = {
  entrance: "Entrance",
  combat: DESTINATIONS.NORMAL_COMBAT,
  elite: DESTINATIONS.ELITE_COMBAT,
  rest: DESTINATIONS.CAMPFIRE,
  mystery: DESTINATIONS.MYSTERY,
  shop: DESTINATIONS.CARD_SHOP,
  alchemist: DESTINATIONS.ALCHEMIST_SHOP,
  "trinket-shop": DESTINATIONS.TRINKET_SHOP,
  "equipment-shop": DESTINATIONS.EQUIPMENT_SHOP,
  boss: DESTINATIONS.BOSS_COMBAT,
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
