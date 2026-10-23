import { describe, expect, it } from "vitest";
import {
  assertScreenTransitionAllowed,
  isRunResumeTransitionAllowed,
  isRunLoopScreen,
  isScreenTransitionAllowed,
  ROUTE_SCREEN_VALUES,
  ROUTE_SCREENS,
  SCREEN_PHASE,
} from "@/lib/routing";

const RUN_NODES = [
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

const NODE_LEAVE_SCREENS = [
  ROUTE_SCREENS.CAMPFIRE,
  ROUTE_SCREENS.SHOP,
  ROUTE_SCREENS.ALCHEMIST,
  ROUTE_SCREENS.TRINKET_SHOP,
  ROUTE_SCREENS.EQUIPMENT_SHOP,
  ROUTE_SCREENS.MYSTERY,
  ROUTE_SCREENS.CORRUPTION,
  ROUTE_SCREENS.TRANSMUTATION,
] as const;

describe("screen-transition-policy", () => {
  it("permits End Run from every run-loop and meta screen", () => {
    for (const screen of ROUTE_SCREEN_VALUES.filter(
      (screen) => isRunLoopScreen(screen) || SCREEN_PHASE[screen] === "meta",
    )) {
      expect(isScreenTransitionAllowed(screen, ROUTE_SCREENS.GAME_OVER), screen).toBe(true);
    }
  });

  it("fans out from destination and labyrinth map to every run node", () => {
    for (const from of [ROUTE_SCREENS.DESTINATION, ROUTE_SCREENS.LABYRINTH_MAP] as const) {
      for (const to of [...RUN_NODES, ROUTE_SCREENS.DESTINATION, ROUTE_SCREENS.LABYRINTH_MAP, ROUTE_SCREENS.REWARDS]) {
        expect(isScreenTransitionAllowed(from, to), `${from} -> ${to}`).toBe(true);
      }
    }
  });

  it("returns from every run node to the map and destination choice", () => {
    for (const from of NODE_LEAVE_SCREENS) {
      expect(isScreenTransitionAllowed(from, ROUTE_SCREENS.DESTINATION), from).toBe(true);
      expect(isScreenTransitionAllowed(from, ROUTE_SCREENS.LABYRINTH_MAP), from).toBe(true);
    }
  });

  it("advances battle through rewards toward victory or defeat", () => {
    for (const to of [ROUTE_SCREENS.REWARDS, ROUTE_SCREENS.RUN_VICTORY, ROUTE_SCREENS.GAME_OVER] as const) {
      expect(isScreenTransitionAllowed(ROUTE_SCREENS.BATTLE, to), `battle -> ${to}`).toBe(true);
    }
    for (const to of [
      ROUTE_SCREENS.DESTINATION,
      ROUTE_SCREENS.LABYRINTH_MAP,
      ROUTE_SCREENS.BATTLE,
      ROUTE_SCREENS.RUN_VICTORY,
    ] as const) {
      expect(isScreenTransitionAllowed(ROUTE_SCREENS.REWARDS, to), `rewards -> ${to}`).toBe(true);
    }
  });

  it("walks the run setup forward and back", () => {
    expect(isScreenTransitionAllowed(ROUTE_SCREENS.MENU, ROUTE_SCREENS.GAME_MODE_SELECT)).toBe(true);
    expect(isScreenTransitionAllowed(ROUTE_SCREENS.GAME_MODE_SELECT, ROUTE_SCREENS.CHARACTER_SELECT)).toBe(true);
    expect(isScreenTransitionAllowed(ROUTE_SCREENS.CHARACTER_SELECT, ROUTE_SCREENS.DIFFICULTY_SELECT)).toBe(true);
    expect(isScreenTransitionAllowed(ROUTE_SCREENS.CHARACTER_SELECT, ROUTE_SCREENS.BATTLE)).toBe(true);
    expect(isScreenTransitionAllowed(ROUTE_SCREENS.DIFFICULTY_SELECT, ROUTE_SCREENS.BATTLE)).toBe(true);
    expect(isScreenTransitionAllowed(ROUTE_SCREENS.DRAFT_DECK, ROUTE_SCREENS.BATTLE)).toBe(true);
    expect(isScreenTransitionAllowed(ROUTE_SCREENS.CHARACTER_SELECT, ROUTE_SCREENS.DRAFT_DECK)).toBe(true);
    expect(isScreenTransitionAllowed(ROUTE_SCREENS.DRAFT_DECK, ROUTE_SCREENS.LABYRINTH_MAP)).toBe(true);
    expect(isScreenTransitionAllowed(ROUTE_SCREENS.CHARACTER_SELECT, ROUTE_SCREENS.GAME_MODE_SELECT)).toBe(true);
  });

  it("allows same-screen deferred commits", () => {
    for (const screen of ROUTE_SCREEN_VALUES) {
      expect(isScreenTransitionAllowed(screen, screen), screen).toBe(true);
    }
  });

  it("rejects transitions outside the policy", () => {
    expect(isScreenTransitionAllowed(ROUTE_SCREENS.MENU, ROUTE_SCREENS.RUN_VICTORY)).toBe(false);
    expect(() => assertScreenTransitionAllowed(ROUTE_SCREENS.MENU, ROUTE_SCREENS.RUN_VICTORY)).toThrow(
      "Disallowed screen transition: menu -> run-victory",
    );
  });

  it("keeps ordinary meta navigation separate from saved-run resume", () => {
    for (const from of [ROUTE_SCREENS.MENU, ROUTE_SCREENS.GAME_MODE_SELECT, ROUTE_SCREENS.CHARACTER_SELECT] as const) {
      for (const to of [ROUTE_SCREENS.BATTLE, ROUTE_SCREENS.SHOP, ROUTE_SCREENS.REWARDS] as const) {
        expect(isRunResumeTransitionAllowed(from, to), `${from} -> ${to}`).toBe(true);
      }
    }
    expect(isScreenTransitionAllowed(ROUTE_SCREENS.COLLECTION, ROUTE_SCREENS.REWARDS)).toBe(false);
    expect(isScreenTransitionAllowed(ROUTE_SCREENS.MENU, ROUTE_SCREENS.SHOP)).toBe(false);
    expect(isScreenTransitionAllowed(ROUTE_SCREENS.OPTIONS, ROUTE_SCREENS.BATTLE)).toBe(false);
    expect(isRunResumeTransitionAllowed(ROUTE_SCREENS.COLLECTION, ROUTE_SCREENS.REWARDS)).toBe(true);
    expect(isRunResumeTransitionAllowed(ROUTE_SCREENS.BATTLE, ROUTE_SCREENS.REWARDS)).toBe(false);
    expect(isRunResumeTransitionAllowed(ROUTE_SCREENS.MENU, ROUTE_SCREENS.RUN_VICTORY)).toBe(false);
  });
});
