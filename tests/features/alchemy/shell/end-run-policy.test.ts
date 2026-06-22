import { describe, expect, it } from "vitest";
import { shouldSurrenderBattleOnEndRun } from "@/features/alchemy/shell/end-run-policy";
import { CONSTANTS } from "@/features/alchemy/shared/types";

describe("shouldSurrenderBattleOnEndRun", () => {
  it("surrenders campaign battles via forced defeat", () => {
    expect(shouldSurrenderBattleOnEndRun(CONSTANTS.SCREENS.BATTLE, true, CONSTANTS.CONTENT_SYSTEMS.CAMPAIGN)).toBe(
      true,
    );
  });

  it("abandons labyrinth runs during active battle instead of surrendering the node", () => {
    expect(shouldSurrenderBattleOnEndRun(CONSTANTS.SCREENS.BATTLE, true, CONSTANTS.CONTENT_SYSTEMS.LABYRINTH)).toBe(
      false,
    );
  });

  it("abandons when not in battle", () => {
    expect(
      shouldSurrenderBattleOnEndRun(CONSTANTS.SCREENS.LABYRINTH_MAP, false, CONSTANTS.CONTENT_SYSTEMS.LABYRINTH),
    ).toBe(false);
  });
});
