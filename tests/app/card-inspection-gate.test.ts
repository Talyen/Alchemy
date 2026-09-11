import { describe, expect, it } from "vitest";
import { isBattleInspectionBlocked } from "@/app/use-card-inspection";
import type { BattleCard } from "@/lib/game-data";

const strike = { id: "strike", uid: "u1" } as unknown as BattleCard;

describe("isBattleInspectionBlocked", () => {
  it("allows inspection when battle is ready with no animation or hidden cards", () => {
    expect(
      isBattleInspectionBlocked({
        battleReady: true,
        cardAnimationInProgress: false,
        battleState: { hand: [strike] },
        hiddenHandCardKeys: [],
      }),
    ).toBe(false);
  });

  it("blocks when the battle is not ready", () => {
    expect(
      isBattleInspectionBlocked({
        battleReady: false,
        cardAnimationInProgress: false,
        battleState: { hand: [] },
        hiddenHandCardKeys: [],
      }),
    ).toBe(true);
  });

  it("blocks while a card animation is in progress", () => {
    expect(
      isBattleInspectionBlocked({
        battleReady: true,
        cardAnimationInProgress: true,
        battleState: { hand: [strike] },
        hiddenHandCardKeys: [],
      }),
    ).toBe(true);
  });

  it("blocks when the hand contains a hidden card", () => {
    expect(
      isBattleInspectionBlocked({
        battleReady: true,
        cardAnimationInProgress: false,
        battleState: { hand: [strike] },
        hiddenHandCardKeys: ["strike-u1"],
      }),
    ).toBe(true);
  });
});
