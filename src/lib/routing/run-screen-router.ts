// Run screen taxonomy and transition helpers.
// Screen *state* lives in navigation.screen on the run domain store; stores hold run/battle/session data.
// Navigation handlers (use-run-navigation, run-flow-handlers) call navigateTo/goToScreen or createScreenTransition.
//
// Screen transition modes (see shell/screen-transition.ts):
// - navigateTo: default run-loop path — NAVIGATION_DELAY_MS delay + optional deferred store commit after PAGE_EXIT_MS.
// - transitionScreen({ delayMs }): victory → rewards; uses setScreen after delay (no navigateTo commit callback).
// - transitionScreen({ immediate: true }): defeat/game-over and labyrinth abandon — instant setScreen.
// - restoreRun: boot resume — immediate setScreen from persisted currentScreen.
import type { Screen } from "./screens";
import { ROUTE_SCREENS } from "./screens";

/** Screens available from the main menu without an active run. */
const META_SCREENS = [
  ROUTE_SCREENS.MENU,
  ROUTE_SCREENS.GAME_MODE_SELECT,
  ROUTE_SCREENS.CHARACTER_SELECT,
  ROUTE_SCREENS.DIFFICULTY_SELECT,
  ROUTE_SCREENS.DRAFT_DECK,
  ROUTE_SCREENS.OPTIONS,
  ROUTE_SCREENS.COLLECTION,
  ROUTE_SCREENS.TALENTS,
  ROUTE_SCREENS.HOMESTEAD,
  ROUTE_SCREENS.ARMORY,
] as const satisfies readonly Screen[];

/** Screens that only make sense while a run is in progress (or mid-resume). */
const RUN_LOOP_SCREENS = [
  ROUTE_SCREENS.BATTLE,
  ROUTE_SCREENS.REWARDS,
  ROUTE_SCREENS.DESTINATION,
  ROUTE_SCREENS.CAMPFIRE,
  ROUTE_SCREENS.SHOP,
  ROUTE_SCREENS.ALCHEMIST,
  ROUTE_SCREENS.MYSTERY,
  ROUTE_SCREENS.CORRUPTION,
  ROUTE_SCREENS.LABYRINTH_MAP,
  ROUTE_SCREENS.WILDWOOD_RECOVERY,
  ROUTE_SCREENS.WILDWOOD_REMOVAL,
] as const satisfies readonly Screen[];

/** Terminal run outcomes. */
const RUN_END_SCREENS = [
  ROUTE_SCREENS.GAME_OVER,
  ROUTE_SCREENS.RUN_VICTORY,
  ROUTE_SCREENS.RUN_DISCOVERIES,
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

/** True when gameplay expects hasActiveRun and run domain/session data to be populated. */
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
    ROUTE_SCREENS.ARMORY,
  ],
  [ROUTE_SCREENS.GAME_MODE_SELECT]: [ROUTE_SCREENS.MENU, ROUTE_SCREENS.CHARACTER_SELECT],
  [ROUTE_SCREENS.CHARACTER_SELECT]: [ROUTE_SCREENS.GAME_MODE_SELECT, ROUTE_SCREENS.DRAFT_DECK],
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
  [ROUTE_SCREENS.CAMPFIRE]: [ROUTE_SCREENS.DESTINATION, ROUTE_SCREENS.LABYRINTH_MAP],
  [ROUTE_SCREENS.SHOP]: [ROUTE_SCREENS.DESTINATION, ROUTE_SCREENS.LABYRINTH_MAP],
  [ROUTE_SCREENS.ALCHEMIST]: [ROUTE_SCREENS.DESTINATION, ROUTE_SCREENS.LABYRINTH_MAP],
  [ROUTE_SCREENS.MYSTERY]: [ROUTE_SCREENS.DESTINATION, ROUTE_SCREENS.LABYRINTH_MAP],
  [ROUTE_SCREENS.CORRUPTION]: [ROUTE_SCREENS.DESTINATION, ROUTE_SCREENS.LABYRINTH_MAP],
  [ROUTE_SCREENS.LABYRINTH_MAP]: [
    ROUTE_SCREENS.BATTLE,
    ROUTE_SCREENS.CAMPFIRE,
    ROUTE_SCREENS.SHOP,
    ROUTE_SCREENS.ALCHEMIST,
    ROUTE_SCREENS.MYSTERY,
  ],
  [ROUTE_SCREENS.WILDWOOD_RECOVERY]: [ROUTE_SCREENS.REWARDS],
  [ROUTE_SCREENS.WILDWOOD_REMOVAL]: [ROUTE_SCREENS.BATTLE],
};

/** Terminal outcomes after run-end teardown (registered in screen-routes/run-end-routes.tsx). */
export const DOCUMENTED_RUN_END_TRANSITIONS: Partial<Record<Screen, readonly Screen[]>> = {
  [ROUTE_SCREENS.GAME_OVER]: [ROUTE_SCREENS.RUN_DISCOVERIES, ROUTE_SCREENS.MENU],
  [ROUTE_SCREENS.RUN_VICTORY]: [ROUTE_SCREENS.RUN_DISCOVERIES, ROUTE_SCREENS.MENU],
  [ROUTE_SCREENS.RUN_DISCOVERIES]: [ROUTE_SCREENS.MENU],
};

export function isDocumentedTransition(from: Screen, to: Screen): boolean {
  const meta = DOCUMENTED_META_TRANSITIONS[from];
  if (meta?.includes(to)) return true;
  const run = DOCUMENTED_RUN_LOOP_TRANSITIONS[from];
  if (run?.includes(to)) return true;
  const runEnd = DOCUMENTED_RUN_END_TRANSITIONS[from];
  if (runEnd?.includes(to)) return true;
  return false;
}

/** High-level run lifecycle phase for persistence and orchestration. */
export type RunPhase = "meta" | "runLoop" | "battle" | "runEnd";

/** Derives run phase from the current screen and whether combat state is active. */
export function getRunPhase(screen: Screen, hasActiveBattle: boolean): RunPhase {
  if (isRunEndScreen(screen)) return "runEnd";
  if (screen === ROUTE_SCREENS.BATTLE && hasActiveBattle) return "battle";
  if (isRunLoopScreen(screen)) return "runLoop";
  return "meta";
}
