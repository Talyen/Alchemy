import { isRunResumeScreen, SCREEN_PHASE } from "./run-screen-router";
import { ROUTE_SCREENS, type Screen } from "./screens";

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

// Browsing can return to setup and recap callers. Live activities still use
// the dedicated resume transition so their current saved phase wins.
const META_BROWSING_TARGETS = [
  ...RUN_LOOP_SHELL_DESTINATIONS,
  ROUTE_SCREENS.RUN_VICTORY,
  ROUTE_SCREENS.GAME_MODE_SELECT,
  ROUTE_SCREENS.CHARACTER_SELECT,
  ROUTE_SCREENS.DIFFICULTY_SELECT,
] as const;

// The record requires every screen at compile time, with shared targets for
// browsing and room visits instead of constructing and checking it at runtime.
const ALLOWED_SCREEN_TRANSITIONS: Record<Screen, readonly Screen[]> = {
  [ROUTE_SCREENS.MENU]: [ROUTE_SCREENS.GAME_MODE_SELECT, ...RUN_LOOP_SHELL_DESTINATIONS],
  [ROUTE_SCREENS.GAME_OVER]: META_DESTINATIONS,
  [ROUTE_SCREENS.RUN_VICTORY]: META_DESTINATIONS,
  [ROUTE_SCREENS.GAME_MODE_SELECT]: [...RUN_LOOP_SHELL_DESTINATIONS, ROUTE_SCREENS.CHARACTER_SELECT],
  [ROUTE_SCREENS.CHARACTER_SELECT]: [
    ...RUN_LOOP_SHELL_DESTINATIONS,
    ROUTE_SCREENS.GAME_MODE_SELECT,
    ROUTE_SCREENS.DIFFICULTY_SELECT,
    ROUTE_SCREENS.DRAFT_DECK,
    ROUTE_SCREENS.BATTLE,
    ROUTE_SCREENS.LABYRINTH_MAP,
  ],
  [ROUTE_SCREENS.DIFFICULTY_SELECT]: [
    ...RUN_LOOP_SHELL_DESTINATIONS,
    ROUTE_SCREENS.CHARACTER_SELECT,
    ROUTE_SCREENS.DRAFT_DECK,
    ROUTE_SCREENS.BATTLE,
  ],
  [ROUTE_SCREENS.DRAFT_DECK]: [
    ...RUN_LOOP_SHELL_DESTINATIONS,
    ROUTE_SCREENS.DIFFICULTY_SELECT,
    ROUTE_SCREENS.BATTLE,
    ROUTE_SCREENS.LABYRINTH_MAP,
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
  [ROUTE_SCREENS.COLLECTION]: META_BROWSING_TARGETS,
  [ROUTE_SCREENS.TALENTS]: META_BROWSING_TARGETS,
  [ROUTE_SCREENS.HOMESTEAD]: META_BROWSING_TARGETS,
  [ROUTE_SCREENS.ARMORY]: META_BROWSING_TARGETS,
  [ROUTE_SCREENS.OPTIONS]: META_BROWSING_TARGETS,
  [ROUTE_SCREENS.CAMPFIRE]: RUN_NODE_LEAVE_DESTINATIONS,
  [ROUTE_SCREENS.SHOP]: RUN_NODE_LEAVE_DESTINATIONS,
  [ROUTE_SCREENS.ALCHEMIST]: RUN_NODE_LEAVE_DESTINATIONS,
  [ROUTE_SCREENS.TRINKET_SHOP]: RUN_NODE_LEAVE_DESTINATIONS,
  [ROUTE_SCREENS.EQUIPMENT_SHOP]: RUN_NODE_LEAVE_DESTINATIONS,
  [ROUTE_SCREENS.MYSTERY]: RUN_NODE_LEAVE_DESTINATIONS,
  [ROUTE_SCREENS.TRANSMUTATION]: RUN_NODE_LEAVE_DESTINATIONS,
  [ROUTE_SCREENS.CORRUPTION]: RUN_NODE_LEAVE_DESTINATIONS,
};

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
