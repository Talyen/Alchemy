// Run screen taxonomy and transition helpers.
// Screen *state* lives in navigation.screen on the run domain store; stores hold run/battle/session data.
// Navigation handlers (use-run-flow-engine, run-flow-handlers) call navigateTo/goToScreen or createScreenTransition.
//
// Screen transition modes (see shell/screen-transition.ts):
// - navigateTo: default run-loop path — NAVIGATION_DELAY_MS delay + optional deferred store commit after PAGE_EXIT_MS.
// - transitionScreen({ delayMs }): victory → rewards; uses setScreen after delay (no navigateTo commit callback).
// - transitionScreen({ immediate: true }): defeat/game-over and labyrinth abandon — instant setScreen.
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
  [ROUTE_SCREENS.WILDWOOD_RECOVERY]: "runLoop",
  [ROUTE_SCREENS.WILDWOOD_REMOVAL]: "runLoop",
  [ROUTE_SCREENS.GAME_OVER]: "runEnd",
  [ROUTE_SCREENS.RUN_VICTORY]: "runEnd",
};

export function isMetaScreen(screen: Screen): boolean {
  return SCREEN_PHASE[screen] === "meta";
}

export function isRunLoopScreen(screen: Screen): boolean {
  return SCREEN_PHASE[screen] === "runLoop";
}

export function isRunEndScreen(screen: Screen): boolean {
  return SCREEN_PHASE[screen] === "runEnd";
}

/** True when gameplay expects hasActiveRun and run domain/session data to be populated. */
export function requiresActiveRun(screen: Screen): boolean {
  const phase = SCREEN_PHASE[screen];
  return phase === "runLoop" || phase === "runEnd";
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
    ROUTE_SCREENS.TRINKET_SHOP,
    ROUTE_SCREENS.EQUIPMENT_SHOP,
    ROUTE_SCREENS.MYSTERY,
    ROUTE_SCREENS.CORRUPTION,
    ROUTE_SCREENS.LABYRINTH_MAP,
  ],
  [ROUTE_SCREENS.CAMPFIRE]: [ROUTE_SCREENS.DESTINATION, ROUTE_SCREENS.LABYRINTH_MAP],
  [ROUTE_SCREENS.SHOP]: [ROUTE_SCREENS.DESTINATION, ROUTE_SCREENS.LABYRINTH_MAP],
  [ROUTE_SCREENS.ALCHEMIST]: [ROUTE_SCREENS.DESTINATION, ROUTE_SCREENS.LABYRINTH_MAP],
  [ROUTE_SCREENS.TRINKET_SHOP]: [ROUTE_SCREENS.DESTINATION, ROUTE_SCREENS.LABYRINTH_MAP],
  [ROUTE_SCREENS.EQUIPMENT_SHOP]: [ROUTE_SCREENS.DESTINATION, ROUTE_SCREENS.LABYRINTH_MAP],
  [ROUTE_SCREENS.MYSTERY]: [ROUTE_SCREENS.DESTINATION, ROUTE_SCREENS.LABYRINTH_MAP],
  [ROUTE_SCREENS.CORRUPTION]: [ROUTE_SCREENS.DESTINATION, ROUTE_SCREENS.LABYRINTH_MAP],
  [ROUTE_SCREENS.LABYRINTH_MAP]: [
    ROUTE_SCREENS.BATTLE,
    ROUTE_SCREENS.CAMPFIRE,
    ROUTE_SCREENS.SHOP,
    ROUTE_SCREENS.ALCHEMIST,
    ROUTE_SCREENS.TRINKET_SHOP,
    ROUTE_SCREENS.EQUIPMENT_SHOP,
    ROUTE_SCREENS.MYSTERY,
  ],
  [ROUTE_SCREENS.WILDWOOD_RECOVERY]: [ROUTE_SCREENS.REWARDS],
  [ROUTE_SCREENS.WILDWOOD_REMOVAL]: [ROUTE_SCREENS.BATTLE],
};

/** Terminal outcomes after run-end teardown (registered in screen-routes/run-end-routes.tsx). */
export const DOCUMENTED_RUN_END_TRANSITIONS: Partial<Record<Screen, readonly Screen[]>> = {
  [ROUTE_SCREENS.GAME_OVER]: [ROUTE_SCREENS.MENU],
  [ROUTE_SCREENS.RUN_VICTORY]: [ROUTE_SCREENS.MENU],
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

/** Derives run phase from the current screen and whether combat state is active. */
export function getRunPhase(screen: Screen, hasActiveBattle: boolean): RunPhase {
  if (hasActiveBattle && screen === ROUTE_SCREENS.BATTLE) return "battle";
  return SCREEN_PHASE[screen];
}
