import { ROUTE_SCREENS, ROUTE_SCREEN_VALUES, type Screen } from "./screens";

export type RunPhase = "meta" | "runLoop" | "battle" | "runEnd";

const META_SCREENS: ReadonlySet<Screen> = new Set([
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
]);

const RUN_END_SCREENS: ReadonlySet<Screen> = new Set([ROUTE_SCREENS.GAME_OVER, ROUTE_SCREENS.RUN_VICTORY]);

function phaseForScreen(screen: Screen): RunPhase {
  if (META_SCREENS.has(screen)) return "meta";
  if (RUN_END_SCREENS.has(screen)) return "runEnd";
  return "runLoop";
}

export const SCREEN_PHASE: Record<Screen, RunPhase> = Object.fromEntries(
  ROUTE_SCREEN_VALUES.map((screen) => [screen, phaseForScreen(screen)]),
) as Record<Screen, RunPhase>;

export function isRunLoopScreen(screen: Screen): boolean {
  return SCREEN_PHASE[screen] === "runLoop";
}

export function isRunResumeScreen(screen: Screen): boolean {
  return isRunLoopScreen(screen) || screen === ROUTE_SCREENS.DRAFT_DECK || screen === ROUTE_SCREENS.DIFFICULTY_SELECT;
}

export function getRunPhase(screen: Screen, hasActiveBattle: boolean): RunPhase {
  if (hasActiveBattle && screen === ROUTE_SCREENS.BATTLE) return "battle";
  return SCREEN_PHASE[screen];
}
