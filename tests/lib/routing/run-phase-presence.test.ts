import { describe, expect, it } from "vitest";
import { getSteamRichPresenceLabel } from "@/lib/routing/run-phase-presence";
import { ROUTE_SCREENS } from "@/lib/routing";

describe("getSteamRichPresenceLabel", () => {
  it("uses battle phase for active combat", () => {
    expect(getSteamRichPresenceLabel(ROUTE_SCREENS.BATTLE, "battle", "mage")).toBe("Fighting as mage");
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
