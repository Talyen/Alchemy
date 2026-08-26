import { describe, expect, it } from "vitest";
import { shouldSurrenderBattleOnEndRun } from "@/features/alchemy/shell/end-run-policy";
import { ROUTE_SCREENS } from "@/lib/routing";
import { CONTENT_SYSTEMS } from "@/lib/content-systems/types";

describe("shouldSurrenderBattleOnEndRun", () => {
  it("surrenders campaign battles via forced defeat", () => {
    expect(shouldSurrenderBattleOnEndRun(ROUTE_SCREENS.BATTLE, true, CONTENT_SYSTEMS.CAMPAIGN)).toBe(true);
  });

  it("abandons labyrinth runs during active battle instead of surrendering the node", () => {
    expect(shouldSurrenderBattleOnEndRun(ROUTE_SCREENS.BATTLE, true, CONTENT_SYSTEMS.LABYRINTH)).toBe(false);
  });

  it("abandons when not in battle", () => {
    expect(shouldSurrenderBattleOnEndRun(ROUTE_SCREENS.LABYRINTH_MAP, false, CONTENT_SYSTEMS.LABYRINTH)).toBe(false);
  });
});
