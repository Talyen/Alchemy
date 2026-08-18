import { describe, expect, it } from "vitest";
import {
  getRunPhase,
  isMetaScreen,
  isRunEndScreen,
  isRunLoopScreen,
  requiresActiveRun,
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

  it("derives run phase from screen and active battle flag", () => {
    expect(getRunPhase(ROUTE_SCREENS.MENU, false)).toBe("meta");
    expect(getRunPhase(ROUTE_SCREENS.SHOP, false)).toBe("runLoop");
    expect(getRunPhase(ROUTE_SCREENS.BATTLE, true)).toBe("battle");
    expect(getRunPhase(ROUTE_SCREENS.BATTLE, false)).toBe("runLoop");
    expect(getRunPhase(ROUTE_SCREENS.GAME_OVER, false)).toBe("runEnd");
  });
});
