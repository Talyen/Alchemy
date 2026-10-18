import { describe, expect, it } from "vitest";
import { getRunPhase, isRunLoopScreen, ROUTE_SCREENS, type Screen } from "@/lib/routing";
import { getSteamRichPresenceToken, STEAM_SCREEN_LABELS } from "@/lib/routing/run-phase-presence";

describe("run-screen-router", () => {
  it("classifies run loop screens", () => {
    expect(isRunLoopScreen(ROUTE_SCREENS.BATTLE)).toBe(true);
    expect(isRunLoopScreen(ROUTE_SCREENS.SHOP)).toBe(true);
    expect(isRunLoopScreen(ROUTE_SCREENS.MENU)).toBe(false);
  });

  it("derives run phase from screen and active battle flag", () => {
    expect(getRunPhase(ROUTE_SCREENS.MENU, false)).toBe("meta");
    expect(getRunPhase(ROUTE_SCREENS.SHOP, false)).toBe("runLoop");
    expect(getRunPhase(ROUTE_SCREENS.BATTLE, true)).toBe("battle");
    expect(getRunPhase(ROUTE_SCREENS.BATTLE, false)).toBe("runLoop");
    expect(getRunPhase(ROUTE_SCREENS.GAME_OVER, false)).toBe("runEnd");
  });
});

describe("steam presence tokens", () => {
  it("maps run-end and battle phases to fixed tokens", () => {
    expect(getSteamRichPresenceToken(ROUTE_SCREENS.RUN_VICTORY, "runEnd")).toBe("#alchemy_victory");
    expect(getSteamRichPresenceToken(ROUTE_SCREENS.GAME_OVER, "runEnd")).toBe("#alchemy_run_ended");
    expect(getSteamRichPresenceToken(ROUTE_SCREENS.BATTLE, "battle")).toBe("#alchemy_battle");
  });

  it("derives one well-formed token per labeled screen", () => {
    for (const screen of Object.keys(STEAM_SCREEN_LABELS) as Screen[]) {
      const token = getSteamRichPresenceToken(screen, "runLoop");
      expect(token).toMatch(/^#[a-zA-Z0-9_]+$/);
    }
    expect(getSteamRichPresenceToken(ROUTE_SCREENS.MENU, "meta")).toBe("#alchemy_menu");
  });
});
