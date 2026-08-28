import type { Screen } from "./screens";
import { ROUTE_SCREENS } from "./screens";

export type RunPhase = "meta" | "runLoop" | "battle" | "runEnd";

export const SCREEN_PHASE: Record<Screen, RunPhase> = {
  [ROUTE_SCREENS.MENU]: "meta",
  [ROUTE_SCREENS.GAME_MODE_SELECT]: "meta",
  [ROUTE_SCREENS.CHARACTER_SELECT]: "meta",
  [ROUTE_SCREENS.DIFFICULTY_SELECT]: "meta",
  [ROUTE_SCREENS.DRAFT_DECK]: "meta",
  [ROUTE_SCREENS.OPTIONS]: "meta",
  [ROUTE_SCREENS.COLLECTION]: "meta",
  [ROUTE_SCREENS.TALENTS]: "meta",
  [ROUTE_SCREENS.HOMESTEAD]: "meta",
  [ROUTE_SCREENS.ARMORY]: "meta",
  [ROUTE_SCREENS.BATTLE]: "runLoop",
  [ROUTE_SCREENS.REWARDS]: "runLoop",
  [ROUTE_SCREENS.DESTINATION]: "runLoop",
  [ROUTE_SCREENS.CAMPFIRE]: "runLoop",
  [ROUTE_SCREENS.SHOP]: "runLoop",
  [ROUTE_SCREENS.ALCHEMIST]: "runLoop",
  [ROUTE_SCREENS.TRINKET_SHOP]: "runLoop",
  [ROUTE_SCREENS.EQUIPMENT_SHOP]: "runLoop",
  [ROUTE_SCREENS.MYSTERY]: "runLoop",
  [ROUTE_SCREENS.CORRUPTION]: "runLoop",
  [ROUTE_SCREENS.LABYRINTH_MAP]: "runLoop",
  [ROUTE_SCREENS.WILDWOOD_REMOVAL]: "runLoop",
  [ROUTE_SCREENS.GAME_OVER]: "runEnd",
  [ROUTE_SCREENS.RUN_VICTORY]: "runEnd",
};

export function isRunLoopScreen(screen: Screen): boolean {
  return SCREEN_PHASE[screen] === "runLoop";
}

export function getRunPhase(screen: Screen, hasActiveBattle: boolean): RunPhase {
  if (hasActiveBattle && screen === ROUTE_SCREENS.BATTLE) return "battle";
  return SCREEN_PHASE[screen];
}
