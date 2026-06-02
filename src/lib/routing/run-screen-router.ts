// Run screen taxonomy and transition helpers.
// Screen *state* lives in use-alchemy-run-controller (React); stores hold run/battle/session data.
// Navigation handlers (use-run-navigation, run-destination-handlers) call navigateTo/goToScreen.
import type { Screen } from "./screens";
import { ROUTE_SCREENS } from "./screens";

/** Screens available from the main menu without an active run. */
export const META_SCREENS = [
  ROUTE_SCREENS.MENU,
  ROUTE_SCREENS.GAME_MODE_SELECT,
  ROUTE_SCREENS.CHARACTER_SELECT,
  ROUTE_SCREENS.DIFFICULTY_SELECT,
  ROUTE_SCREENS.DRAFT_DECK,
  ROUTE_SCREENS.WILDWOOD_SELECT,
  ROUTE_SCREENS.OPTIONS,
  ROUTE_SCREENS.COLLECTION,
  ROUTE_SCREENS.TALENTS,
  ROUTE_SCREENS.HOMESTEAD,
] as const satisfies readonly Screen[];

/** Screens that only make sense while a run is in progress (or mid-resume). */
export const RUN_LOOP_SCREENS = [
  ROUTE_SCREENS.BATTLE,
  ROUTE_SCREENS.REWARDS,
  ROUTE_SCREENS.DESTINATION,
  ROUTE_SCREENS.CAMPFIRE,
  ROUTE_SCREENS.SHOP,
  ROUTE_SCREENS.ALCHEMIST,
  ROUTE_SCREENS.MYSTERY,
  ROUTE_SCREENS.CORRUPTION,
  ROUTE_SCREENS.LABYRINTH_MAP,
] as const satisfies readonly Screen[];

/** Terminal run outcomes. */
export const RUN_END_SCREENS = [
  ROUTE_SCREENS.GAME_OVER,
  ROUTE_SCREENS.RUN_VICTORY,
] as const satisfies readonly Screen[];

const META_SCREEN_SET = new Set<Screen>(META_SCREENS);
const RUN_LOOP_SET = new Set<Screen>(RUN_LOOP_SCREENS);
const RUN_END_SET = new Set<Screen>(RUN_END_SCREENS);

export function isMetaScreen(screen: Screen): boolean {
  return META_SCREEN_SET.has(screen);
}

export function isRunLoopScreen(screen: Screen): boolean {
  return RUN_LOOP_SET.has(screen);
}

export function isRunEndScreen(screen: Screen): boolean {
  return RUN_END_SET.has(screen);
}

/** True when gameplay expects hasActiveRun and run-store/session data to be populated. */
export function requiresActiveRun(screen: Screen): boolean {
  return isRunLoopScreen(screen) || isRunEndScreen(screen);
}

/**
 * Documented menu/meta transitions (not exhaustive — run flow uses reward/destination handlers).
 * Keys are source screens; values are typical targets from navigation.goToScreen.
 */
export const DOCUMENTED_META_TRANSITIONS: Partial<Record<Screen, readonly Screen[]>> = {
  [ROUTE_SCREENS.MENU]: [
    ROUTE_SCREENS.GAME_MODE_SELECT,
    ROUTE_SCREENS.COLLECTION,
    ROUTE_SCREENS.OPTIONS,
    ROUTE_SCREENS.HOMESTEAD,
    ROUTE_SCREENS.TALENTS,
  ],
  [ROUTE_SCREENS.GAME_MODE_SELECT]: [ROUTE_SCREENS.MENU, ROUTE_SCREENS.CHARACTER_SELECT],
  [ROUTE_SCREENS.CHARACTER_SELECT]: [ROUTE_SCREENS.GAME_MODE_SELECT, ROUTE_SCREENS.WILDWOOD_SELECT],
  [ROUTE_SCREENS.WILDWOOD_SELECT]: [ROUTE_SCREENS.CHARACTER_SELECT],
};

/**
 * Typical run-loop transitions after combat and rewards (see navigation/reward-flow.ts).
 */
export const DOCUMENTED_RUN_LOOP_TRANSITIONS: Partial<Record<Screen, readonly Screen[]>> = {
  [ROUTE_SCREENS.BATTLE]: [ROUTE_SCREENS.REWARDS, ROUTE_SCREENS.GAME_OVER, ROUTE_SCREENS.RUN_VICTORY],
  [ROUTE_SCREENS.REWARDS]: [ROUTE_SCREENS.DESTINATION, ROUTE_SCREENS.LABYRINTH_MAP, ROUTE_SCREENS.RUN_VICTORY],
  [ROUTE_SCREENS.DESTINATION]: [
    ROUTE_SCREENS.BATTLE,
    ROUTE_SCREENS.CAMPFIRE,
    ROUTE_SCREENS.SHOP,
    ROUTE_SCREENS.ALCHEMIST,
    ROUTE_SCREENS.MYSTERY,
    ROUTE_SCREENS.CORRUPTION,
    ROUTE_SCREENS.LABYRINTH_MAP,
  ],
};

export function isDocumentedTransition(from: Screen, to: Screen): boolean {
  const meta = DOCUMENTED_META_TRANSITIONS[from];
  if (meta?.includes(to)) return true;
  const run = DOCUMENTED_RUN_LOOP_TRANSITIONS[from];
  if (run?.includes(to)) return true;
  return false;
}
