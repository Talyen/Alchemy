// Steam rich-presence labels derived from run phase and screen (no platform imports).
import type { CharacterId } from "@/lib/game-data";
import type { Screen } from "./screens";
import { ROUTE_SCREENS } from "./screens";
import type { RunPhase } from "./run-screen-router";

const SCREEN_LABELS: Partial<Record<Screen, string>> = {
  [ROUTE_SCREENS.HOMESTEAD]: "Upgrading Homestead",
  [ROUTE_SCREENS.TALENTS]: "Selecting Talents",
  [ROUTE_SCREENS.CAMPFIRE]: "Resting at Campfire",
  [ROUTE_SCREENS.SHOP]: "Trading in Shop",
  [ROUTE_SCREENS.ALCHEMIST]: "Trading in Shop",
  [ROUTE_SCREENS.TRINKET_SHOP]: "Trading in Shop",
  [ROUTE_SCREENS.EQUIPMENT_SHOP]: "Trading in Shop",
  [ROUTE_SCREENS.ARMORY]: "Visiting the Armory",
  [ROUTE_SCREENS.MYSTERY]: "Exploring a Mystery",
  [ROUTE_SCREENS.DESTINATION]: "Navigating the Map",
  [ROUTE_SCREENS.LABYRINTH_MAP]: "Navigating the Map",
  [ROUTE_SCREENS.DRAFT_DECK]: "Drafting starter deck",
  [ROUTE_SCREENS.REWARDS]: "Choosing Rewards",
  [ROUTE_SCREENS.CORRUPTION]: "At the Corruption Altar",
  [ROUTE_SCREENS.WILDWOOD_REMOVAL]: "At the Corruption Altar",
  [ROUTE_SCREENS.BATTLE]: "In Combat",
  [ROUTE_SCREENS.COLLECTION]: "Viewing Collection",
  [ROUTE_SCREENS.OPTIONS]: "In Options",
  [ROUTE_SCREENS.GAME_MODE_SELECT]: "Selecting Game Mode",
  [ROUTE_SCREENS.CHARACTER_SELECT]: "Starting a Run",
  [ROUTE_SCREENS.DIFFICULTY_SELECT]: "Starting a Run",
};

export function getSteamRichPresenceLabel(
  screen: Screen,
  phase: RunPhase,
  characterId: CharacterId | null = null,
): string {
  if (phase === "runEnd") return screen === ROUTE_SCREENS.RUN_VICTORY ? "Run Victory" : "Run Ended";
  if (phase === "battle") return `Fighting as ${characterId ?? "knight"}`;
  return SCREEN_LABELS[screen] ?? "In Menu";
}
