// Run screen taxonomy and transition helpers.
// Screen *state* lives in navigation.screen on the run domain store; stores hold run/battle/session data.
// Navigation handlers (`use-run-flow-engine`, `run-flow-handlers`) call `navigateTo` / `transition`
// from `shell/use-screen-transitions.ts`.
//
// Screen transition modes:
// - navigateTo: default run-loop path — NAVIGATION_DELAY_MS delay + optional deferred store commit after PAGE_EXIT_MS.
// - transition({ delayMs }): victory → rewards; uses setScreen after delay (no navigateTo commit callback).
// - transition({ immediate: true }): defeat/game-over and labyrinth abandon — instant setScreen (cancels pending navigateTo).
// - restoreRun: boot resume — immediate setScreen from persisted currentScreen.
import type { Screen } from "./screens";
import { ROUTE_SCREENS } from "./screens";

/** High-level run lifecycle phase for persistence and orchestration. */
export type RunPhase = "meta" | "runLoop" | "battle" | "runEnd";

/**
 * Static phase classification per screen. Battle is classified as `runLoop` here;
 * `getRunPhase` upgrades `BATTLE` to `battle` when `hasActiveBattle` is true.
 */
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

/** Derives run phase from the current screen and whether combat state is active. */
export function getRunPhase(screen: Screen, hasActiveBattle: boolean): RunPhase {
  if (hasActiveBattle && screen === ROUTE_SCREENS.BATTLE) return "battle";
  return SCREEN_PHASE[screen];
}
