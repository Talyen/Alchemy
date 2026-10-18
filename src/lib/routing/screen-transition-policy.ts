import { isRunResumeScreen, SCREEN_PHASE } from "./run-screen-router";
import { ROUTE_SCREENS, ROUTE_SCREEN_VALUES, type Screen } from "./screens";

const META_DESTINATIONS = [
  ROUTE_SCREENS.MENU,
  ROUTE_SCREENS.COLLECTION,
  ROUTE_SCREENS.TALENTS,
  ROUTE_SCREENS.HOMESTEAD,
  ROUTE_SCREENS.ARMORY,
  ROUTE_SCREENS.OPTIONS,
] as const;

const RUN_LOOP_SHELL_DESTINATIONS = [...META_DESTINATIONS, ROUTE_SCREENS.GAME_OVER] as const;
const RUN_NODE_LEAVE_DESTINATIONS = [
  ...RUN_LOOP_SHELL_DESTINATIONS,
  ROUTE_SCREENS.DESTINATION,
  ROUTE_SCREENS.LABYRINTH_MAP,
] as const;
const RUN_NODE_DESTINATIONS = [
  ...RUN_LOOP_SHELL_DESTINATIONS,
  ROUTE_SCREENS.BATTLE,
  ROUTE_SCREENS.CAMPFIRE,
  ROUTE_SCREENS.SHOP,
  ROUTE_SCREENS.ALCHEMIST,
  ROUTE_SCREENS.TRINKET_SHOP,
  ROUTE_SCREENS.EQUIPMENT_SHOP,
  ROUTE_SCREENS.MYSTERY,
  ROUTE_SCREENS.CORRUPTION,
  ROUTE_SCREENS.TRANSMUTATION,
] as const;
export interface ScreenTransitionOptions {
  delayMs?: number;
  immediate?: boolean;
  prepare?: () => void;
  guard?: () => boolean;
}

const RUN_NODE_LEAVE_SCREENS = [
  ROUTE_SCREENS.CAMPFIRE,
  ROUTE_SCREENS.SHOP,
  ROUTE_SCREENS.ALCHEMIST,
  ROUTE_SCREENS.TRINKET_SHOP,
  ROUTE_SCREENS.EQUIPMENT_SHOP,
  ROUTE_SCREENS.MYSTERY,
  ROUTE_SCREENS.TRANSMUTATION,
  ROUTE_SCREENS.CORRUPTION,
] as const;

// Destination and labyrinth map share one target set: every run node plus each
// other plus rewards. Self-transitions are already allowed via the from === to
// rule in isScreenTransitionAllowed, so listing both is harmless and keeps the
// pair symmetric.
const MAP_TARGETS = [
  ...RUN_NODE_DESTINATIONS,
  ROUTE_SCREENS.DESTINATION,
  ROUTE_SCREENS.LABYRINTH_MAP,
  ROUTE_SCREENS.REWARDS,
] as const;

const META_ONLY_SCREENS = [
  ROUTE_SCREENS.COLLECTION,
  ROUTE_SCREENS.TALENTS,
  ROUTE_SCREENS.HOMESTEAD,
  ROUTE_SCREENS.ARMORY,
  ROUTE_SCREENS.GAME_OVER,
  ROUTE_SCREENS.RUN_VICTORY,
] as const;

function buildAllowedTransitions(): Record<Screen, readonly Screen[]> {
  const allowed: Record<string, readonly Screen[]> = {
    [ROUTE_SCREENS.MENU]: [ROUTE_SCREENS.GAME_MODE_SELECT, ...META_DESTINATIONS],
    [ROUTE_SCREENS.GAME_MODE_SELECT]: [...META_DESTINATIONS, ROUTE_SCREENS.CHARACTER_SELECT],
    [ROUTE_SCREENS.CHARACTER_SELECT]: [
      ...META_DESTINATIONS,
      ROUTE_SCREENS.GAME_MODE_SELECT,
      ROUTE_SCREENS.DIFFICULTY_SELECT,
      ROUTE_SCREENS.DRAFT_DECK,
      ROUTE_SCREENS.BATTLE,
      ROUTE_SCREENS.LABYRINTH_MAP,
    ],
    [ROUTE_SCREENS.DIFFICULTY_SELECT]: [
      ...META_DESTINATIONS,
      ROUTE_SCREENS.CHARACTER_SELECT,
      ROUTE_SCREENS.DRAFT_DECK,
      ROUTE_SCREENS.BATTLE,
    ],
    [ROUTE_SCREENS.DRAFT_DECK]: [
      ...META_DESTINATIONS,
      ROUTE_SCREENS.DIFFICULTY_SELECT,
      ROUTE_SCREENS.BATTLE,
      ROUTE_SCREENS.LABYRINTH_MAP,
    ],
    [ROUTE_SCREENS.OPTIONS]: [
      ...META_DESTINATIONS,
      ROUTE_SCREENS.GAME_OVER,
      ROUTE_SCREENS.RUN_VICTORY,
      ROUTE_SCREENS.GAME_MODE_SELECT,
      ROUTE_SCREENS.CHARACTER_SELECT,
      ROUTE_SCREENS.DIFFICULTY_SELECT,
      ROUTE_SCREENS.DESTINATION,
    ],
    [ROUTE_SCREENS.BATTLE]: [
      ...RUN_LOOP_SHELL_DESTINATIONS,
      ROUTE_SCREENS.REWARDS,
      ROUTE_SCREENS.RUN_VICTORY,
      ROUTE_SCREENS.LABYRINTH_MAP,
    ],
    [ROUTE_SCREENS.REWARDS]: [
      ...RUN_LOOP_SHELL_DESTINATIONS,
      ROUTE_SCREENS.BATTLE,
      ROUTE_SCREENS.DESTINATION,
      ROUTE_SCREENS.LABYRINTH_MAP,
      ROUTE_SCREENS.RUN_VICTORY,
      ROUTE_SCREENS.WILDWOOD_REMOVAL,
    ],
    // An opening Companion victory can settle before the Battle fade commits.
    [ROUTE_SCREENS.DESTINATION]: MAP_TARGETS,
    [ROUTE_SCREENS.LABYRINTH_MAP]: MAP_TARGETS,
    [ROUTE_SCREENS.WILDWOOD_REMOVAL]: [...RUN_LOOP_SHELL_DESTINATIONS, ROUTE_SCREENS.BATTLE],
  };
  for (const screen of META_ONLY_SCREENS) allowed[screen] = META_DESTINATIONS;
  for (const screen of RUN_NODE_LEAVE_SCREENS) allowed[screen] = RUN_NODE_LEAVE_DESTINATIONS;
  // Fail fast when a new screen lacks a policy entry instead of crashing on
  // the first transition check with an obscure undefined dereference.
  for (const screen of ROUTE_SCREEN_VALUES) {
    if (!allowed[screen]) throw new Error(`Missing screen transition policy for: ${screen}`);
  }
  return allowed;
}

const ALLOWED_SCREEN_TRANSITIONS = buildAllowedTransitions();

export function isScreenTransitionAllowed(from: Screen, to: Screen): boolean {
  return from === to || ALLOWED_SCREEN_TRANSITIONS[from].includes(to);
}

export function assertScreenTransitionAllowed(from: Screen, to: Screen): void {
  if (isScreenTransitionAllowed(from, to)) return;
  throw new Error(`Disallowed screen transition: ${from} -> ${to}`);
}

export function isRunResumeTransitionAllowed(from: Screen, to: Screen): boolean {
  return SCREEN_PHASE[from] === "meta" && isRunResumeScreen(to);
}

export function assertRunResumeTransitionAllowed(from: Screen, to: Screen): void {
  if (isRunResumeTransitionAllowed(from, to)) return;
  throw new Error(`Disallowed run resume transition: ${from} -> ${to}`);
}
