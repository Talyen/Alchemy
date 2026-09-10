import { describe, expect, it } from "vitest";
import {
  ALLOWED_SCREEN_TRANSITIONS,
  assertScreenTransitionAllowed,
  isRunLoopScreen,
  isScreenTransitionAllowed,
  ROUTE_SCREEN_VALUES,
  ROUTE_SCREENS,
  SCREEN_PHASE,
  type Screen,
} from "@/lib/routing";

const PRODUCTION_NAVIGATION_EDGES: ReadonlyArray<readonly [Screen, Screen]> = [
  [ROUTE_SCREENS.BATTLE, ROUTE_SCREENS.REWARDS],
  [ROUTE_SCREENS.BATTLE, ROUTE_SCREENS.RUN_VICTORY],
  [ROUTE_SCREENS.BATTLE, ROUTE_SCREENS.GAME_OVER],
  [ROUTE_SCREENS.BATTLE, ROUTE_SCREENS.LABYRINTH_MAP],
  [ROUTE_SCREENS.REWARDS, ROUTE_SCREENS.DESTINATION],
  [ROUTE_SCREENS.REWARDS, ROUTE_SCREENS.LABYRINTH_MAP],
  [ROUTE_SCREENS.REWARDS, ROUTE_SCREENS.BATTLE],
  [ROUTE_SCREENS.REWARDS, ROUTE_SCREENS.RUN_VICTORY],
  [ROUTE_SCREENS.REWARDS, ROUTE_SCREENS.WILDWOOD_REMOVAL],
  [ROUTE_SCREENS.DESTINATION, ROUTE_SCREENS.BATTLE],
  [ROUTE_SCREENS.DESTINATION, ROUTE_SCREENS.CAMPFIRE],
  [ROUTE_SCREENS.DESTINATION, ROUTE_SCREENS.SHOP],
  [ROUTE_SCREENS.DESTINATION, ROUTE_SCREENS.ALCHEMIST],
  [ROUTE_SCREENS.DESTINATION, ROUTE_SCREENS.TRINKET_SHOP],
  [ROUTE_SCREENS.DESTINATION, ROUTE_SCREENS.EQUIPMENT_SHOP],
  [ROUTE_SCREENS.DESTINATION, ROUTE_SCREENS.MYSTERY],
  [ROUTE_SCREENS.DESTINATION, ROUTE_SCREENS.CORRUPTION],
  [ROUTE_SCREENS.DESTINATION, ROUTE_SCREENS.LABYRINTH_MAP],
  [ROUTE_SCREENS.CAMPFIRE, ROUTE_SCREENS.DESTINATION],
  [ROUTE_SCREENS.SHOP, ROUTE_SCREENS.DESTINATION],
  [ROUTE_SCREENS.ALCHEMIST, ROUTE_SCREENS.DESTINATION],
  [ROUTE_SCREENS.TRINKET_SHOP, ROUTE_SCREENS.DESTINATION],
  [ROUTE_SCREENS.EQUIPMENT_SHOP, ROUTE_SCREENS.DESTINATION],
  [ROUTE_SCREENS.MYSTERY, ROUTE_SCREENS.DESTINATION],
  [ROUTE_SCREENS.CORRUPTION, ROUTE_SCREENS.DESTINATION],
  [ROUTE_SCREENS.LABYRINTH_MAP, ROUTE_SCREENS.BATTLE],
  [ROUTE_SCREENS.LABYRINTH_MAP, ROUTE_SCREENS.CORRUPTION],
  [ROUTE_SCREENS.WILDWOOD_REMOVAL, ROUTE_SCREENS.BATTLE],
  [ROUTE_SCREENS.GAME_OVER, ROUTE_SCREENS.MENU],
  [ROUTE_SCREENS.RUN_VICTORY, ROUTE_SCREENS.MENU],
  [ROUTE_SCREENS.GAME_OVER, ROUTE_SCREENS.OPTIONS],
  [ROUTE_SCREENS.OPTIONS, ROUTE_SCREENS.GAME_OVER],
  [ROUTE_SCREENS.RUN_VICTORY, ROUTE_SCREENS.OPTIONS],
  [ROUTE_SCREENS.OPTIONS, ROUTE_SCREENS.RUN_VICTORY],
  [ROUTE_SCREENS.CHARACTER_SELECT, ROUTE_SCREENS.DIFFICULTY_SELECT],
  [ROUTE_SCREENS.CHARACTER_SELECT, ROUTE_SCREENS.BATTLE],
  [ROUTE_SCREENS.CHARACTER_SELECT, ROUTE_SCREENS.LABYRINTH_MAP],
  [ROUTE_SCREENS.DIFFICULTY_SELECT, ROUTE_SCREENS.BATTLE],
  [ROUTE_SCREENS.DRAFT_DECK, ROUTE_SCREENS.BATTLE],
  [ROUTE_SCREENS.GAME_MODE_SELECT, ROUTE_SCREENS.CHARACTER_SELECT],
  [ROUTE_SCREENS.COLLECTION, ROUTE_SCREENS.BATTLE],
];

describe("screen-transition-policy", () => {
  it("defines a transition policy for every screen", () => {
    expect(Object.keys(ALLOWED_SCREEN_TRANSITIONS).sort()).toEqual([...ROUTE_SCREEN_VALUES].sort());
  });

  it("derives run-loop policy members from SCREEN_PHASE", () => {
    const fromPhase = ROUTE_SCREEN_VALUES.filter((screen) => SCREEN_PHASE[screen] === "runLoop").sort();
    const fromClassifier = ROUTE_SCREEN_VALUES.filter(isRunLoopScreen).sort();
    expect(fromPhase).toEqual(fromClassifier);
    for (const screen of fromPhase) {
      expect(isScreenTransitionAllowed(screen, ROUTE_SCREENS.GAME_OVER), screen).toBe(true);
    }
  });

  it("allows production run-flow and destination navigation edges", () => {
    for (const [from, to] of PRODUCTION_NAVIGATION_EDGES) {
      expect(isScreenTransitionAllowed(from, to), `${from} -> ${to}`).toBe(true);
    }
  });

  it("allows same-screen deferred commits", () => {
    expect(isScreenTransitionAllowed(ROUTE_SCREENS.REWARDS, ROUTE_SCREENS.REWARDS)).toBe(true);
  });

  it("rejects transitions outside the policy", () => {
    expect(isScreenTransitionAllowed(ROUTE_SCREENS.MENU, ROUTE_SCREENS.RUN_VICTORY)).toBe(false);
    expect(() => assertScreenTransitionAllowed(ROUTE_SCREENS.MENU, ROUTE_SCREENS.RUN_VICTORY)).toThrow(
      "Disallowed screen transition: menu -> run-victory",
    );
  });

  it("allows saved gameplay and starter drafts to resume from menus and setup", () => {
    for (const from of ["menu", "game-mode-select", "character-select", "difficulty-select", "options"] as const) {
      for (const to of ["battle", "labyrinth-map", "shop", "rewards", "draft-deck", "difficulty-select"] as const) {
        expect(isScreenTransitionAllowed(from, to), `${from} -> ${to}`).toBe(true);
      }
    }
  });
});
