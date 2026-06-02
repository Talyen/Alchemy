import { describe, expect, it } from "vitest";
import {
  DOCUMENTED_META_TRANSITIONS,
  DOCUMENTED_RUN_LOOP_TRANSITIONS,
  isDocumentedTransition,
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

  it("documents known meta transitions", () => {
    expect(DOCUMENTED_META_TRANSITIONS[ROUTE_SCREENS.MENU]).toContain(ROUTE_SCREENS.TALENTS);
    expect(isDocumentedTransition(ROUTE_SCREENS.MENU, ROUTE_SCREENS.TALENTS)).toBe(true);
  });

  it("documents known run loop transitions", () => {
    expect(DOCUMENTED_RUN_LOOP_TRANSITIONS[ROUTE_SCREENS.BATTLE]).toContain(ROUTE_SCREENS.REWARDS);
    expect(isDocumentedTransition(ROUTE_SCREENS.BATTLE, ROUTE_SCREENS.REWARDS)).toBe(true);
  });
});
