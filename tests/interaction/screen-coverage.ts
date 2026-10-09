import type { Screen } from "@/lib/routing";
import type { Family } from "./sequence";

/** Shared lifecycle ownership; README names the retained screen-specific protection. */
export const SCREEN_FAMILIES: Record<Screen, readonly Family[]> = {
  menu: ["navigation", "startup"],
  "game-mode-select": ["navigation"],
  "character-select": ["navigation"],
  "difficulty-select": ["navigation"],
  "draft-deck": ["navigation"],
  battle: ["battle", "overlays"],
  rewards: ["visits", "navigation"],
  destination: ["visits", "navigation"],
  options: ["navigation", "overlays"],
  collection: ["navigation", "overlays"],
  talents: ["armory", "navigation"],
  homestead: ["armory", "navigation"],
  armory: ["armory"],
  "game-over": ["visits", "navigation"],
  campfire: ["visits"],
  shop: ["visits"],
  alchemist: ["visits"],
  "trinket-shop": ["visits"],
  "equipment-shop": ["visits"],
  mystery: ["visits", "navigation"],
  corruption: ["visits", "navigation"],
  transmutation: ["visits"],
  "run-victory": ["visits", "navigation"],
  "labyrinth-map": ["visits", "navigation"],
  "wildwood-removal": ["visits", "navigation"],
};
