import { describe, expect, it } from "vitest";
import { getRunPhase, isRunLoopScreen, ROUTE_SCREENS } from "@/lib/routing";
import { getSteamRichPresenceLabel } from "@/lib/routing/run-phase-presence";
import { wildwoodPhaseToScreen } from "@/features/alchemy/shared/run-flow/wildwood-screen-routing";

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

describe("getSteamRichPresenceLabel", () => {
  it("uses battle phase for active combat", () => {
    expect(getSteamRichPresenceLabel(ROUTE_SCREENS.BATTLE, "battle", "wizard")).toBe("Fighting as wizard");
  });

  it("labels run-end screens", () => {
    expect(getSteamRichPresenceLabel(ROUTE_SCREENS.GAME_OVER, "runEnd")).toBe("Run Ended");
    expect(getSteamRichPresenceLabel(ROUTE_SCREENS.RUN_VICTORY, "runEnd")).toBe("Run Victory");
  });

  it("labels meta and run-loop screens by screen when not in battle phase", () => {
    expect(getSteamRichPresenceLabel(ROUTE_SCREENS.HOMESTEAD, "meta")).toBe("Upgrading Homestead");
    expect(getSteamRichPresenceLabel(ROUTE_SCREENS.SHOP, "runLoop")).toBe("Trading in Shop");
    expect(getSteamRichPresenceLabel(ROUTE_SCREENS.BATTLE, "runLoop")).toBe("In Combat");
    expect(getSteamRichPresenceLabel(ROUTE_SCREENS.MENU, "meta")).toBe("In Menu");
  });
});

describe("wildwoodPhaseToScreen", () => {
  it("maps every live phase to the matching resume screen", () => {
    expect(wildwoodPhaseToScreen("draft")).toBe("draft-deck");
    expect(wildwoodPhaseToScreen("battle")).toBe("battle");
    expect(wildwoodPhaseToScreen("reward")).toBe("rewards");
    expect(wildwoodPhaseToScreen("removal")).toBe("wildwood-removal");
  });
});
