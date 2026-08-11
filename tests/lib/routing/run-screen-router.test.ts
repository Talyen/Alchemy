import { describe, expect, it } from "vitest";
import {
  ALLOWED_SCREEN_TRANSITIONS,
  assertScreenTransitionAllowed,
  getRunPhase,
  isScreenTransitionAllowed,
  isMetaScreen,
  isRunEndScreen,
  isRunLoopScreen,
  requiresActiveRun,
  ROUTE_SCREEN_VALUES,
  ROUTE_SCREENS,
} from "@/lib/routing";

describe("run-screen-router", () => {
  it("classifies meta screens", () => {
    expect(isMetaScreen(ROUTE_SCREENS.MENU)).toBe(true);
    expect(isMetaScreen(ROUTE_SCREENS.HOMESTEAD)).toBe(true);
    expect(isMetaScreen(ROUTE_SCREENS.BATTLE)).toBe(false);
  });

  it("classifies run loop screens", () => {
    expect(isRunLoopScreen(ROUTE_SCREENS.BATTLE)).toBe(true);
    expect(isRunLoopScreen(ROUTE_SCREENS.SHOP)).toBe(true);
    expect(isRunLoopScreen(ROUTE_SCREENS.MENU)).toBe(false);
  });

  it("classifies run end screens", () => {
    expect(isRunEndScreen(ROUTE_SCREENS.GAME_OVER)).toBe(true);
    expect(isRunEndScreen(ROUTE_SCREENS.RUN_VICTORY)).toBe(true);
    expect(isRunEndScreen(ROUTE_SCREENS.BATTLE)).toBe(false);
  });

  it("requires active run for loop and end screens", () => {
    expect(requiresActiveRun(ROUTE_SCREENS.DESTINATION)).toBe(true);
    expect(requiresActiveRun(ROUTE_SCREENS.GAME_OVER)).toBe(true);
    expect(requiresActiveRun(ROUTE_SCREENS.MENU)).toBe(false);
  });

  it("defines a transition policy for every screen", () => {
    expect(Object.keys(ALLOWED_SCREEN_TRANSITIONS).sort()).toEqual([...ROUTE_SCREEN_VALUES].sort());
  });

  it("allows setup, run-loop, run-end, and return-to-run transitions", () => {
    expect(isScreenTransitionAllowed(ROUTE_SCREENS.CHARACTER_SELECT, ROUTE_SCREENS.DIFFICULTY_SELECT)).toBe(true);
    expect(isScreenTransitionAllowed(ROUTE_SCREENS.BATTLE, ROUTE_SCREENS.REWARDS)).toBe(true);
    expect(isScreenTransitionAllowed(ROUTE_SCREENS.GAME_OVER, ROUTE_SCREENS.MENU)).toBe(true);
    expect(isScreenTransitionAllowed(ROUTE_SCREENS.COLLECTION, ROUTE_SCREENS.BATTLE)).toBe(true);
  });

  it("allows the shell to abandon every run-loop screen", () => {
    for (const screen of ROUTE_SCREEN_VALUES.filter(isRunLoopScreen)) {
      expect(isScreenTransitionAllowed(screen, ROUTE_SCREENS.GAME_OVER), screen).toBe(true);
    }
  });

  it("allows same-screen deferred commits", () => {
    expect(isScreenTransitionAllowed(ROUTE_SCREENS.REWARDS, ROUTE_SCREENS.REWARDS)).toBe(true);
  });

  it("rejects transitions outside the policy", () => {
    expect(isScreenTransitionAllowed(ROUTE_SCREENS.MENU, ROUTE_SCREENS.BATTLE)).toBe(false);
    expect(() => assertScreenTransitionAllowed(ROUTE_SCREENS.MENU, ROUTE_SCREENS.BATTLE)).toThrow(
      "Disallowed screen transition: menu -> battle",
    );
  });

  it("derives run phase from screen and active battle flag", () => {
    expect(getRunPhase(ROUTE_SCREENS.MENU, false)).toBe("meta");
    expect(getRunPhase(ROUTE_SCREENS.SHOP, false)).toBe("runLoop");
    expect(getRunPhase(ROUTE_SCREENS.BATTLE, true)).toBe("battle");
    expect(getRunPhase(ROUTE_SCREENS.BATTLE, false)).toBe("runLoop");
    expect(getRunPhase(ROUTE_SCREENS.GAME_OVER, false)).toBe("runEnd");
  });
});
