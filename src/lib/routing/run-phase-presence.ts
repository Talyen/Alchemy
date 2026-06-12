// Steam rich-presence labels derived from run phase and screen (no platform imports).
import type { CharacterId } from "@/lib/game-data";
import type { Screen } from "./screens";
import { ROUTE_SCREENS } from "./screens";
import type { RunPhase } from "./run-screen-router";

export function getSteamRichPresenceLabel(
  screen: Screen,
  phase: RunPhase,
  characterId: CharacterId | null = null,
): string {
  if (phase === "runEnd") {
    return screen === ROUTE_SCREENS.RUN_VICTORY ? "Run Victory" : "Run Ended";
  }
  if (phase === "battle") {
    return `Fighting as ${characterId ?? "knight"}`;
  }

  switch (screen) {
    case ROUTE_SCREENS.HOMESTEAD:
      return "Upgrading Homestead";
    case ROUTE_SCREENS.TALENTS:
      return "Selecting Talents";
    case ROUTE_SCREENS.CAMPFIRE:
    case ROUTE_SCREENS.WILDWOOD_RECOVERY:
      return "Resting at Campfire";
    case ROUTE_SCREENS.SHOP:
    case ROUTE_SCREENS.ALCHEMIST:
      return "Trading in Shop";
    case ROUTE_SCREENS.MYSTERY:
      return "Exploring a Mystery";
    case ROUTE_SCREENS.DESTINATION:
    case ROUTE_SCREENS.LABYRINTH_MAP:
      return "Navigating the Map";
    case ROUTE_SCREENS.DRAFT_DECK:
      return "Drafting starter deck";
    case ROUTE_SCREENS.REWARDS:
      return "Choosing Rewards";
    case ROUTE_SCREENS.CORRUPTION:
    case ROUTE_SCREENS.WILDWOOD_REMOVAL:
      return "At the Corruption Altar";
    case ROUTE_SCREENS.BATTLE:
      return "In Combat";
    case ROUTE_SCREENS.COLLECTION:
      return "Viewing Collection";
    case ROUTE_SCREENS.OPTIONS:
      return "In Options";
    case ROUTE_SCREENS.GAME_MODE_SELECT:
      return "Selecting Game Mode";
    case ROUTE_SCREENS.CHARACTER_SELECT:
    case ROUTE_SCREENS.DIFFICULTY_SELECT:
      return "Starting a Run";
    default:
      return "In Menu";
  }
}
