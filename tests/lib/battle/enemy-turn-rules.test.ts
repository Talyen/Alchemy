import { describe, expect, it } from "vitest";
import {
  isEveryOtherTurnScalingTurn,
  isFreezeActiveForAspect,
  scaleByRoomMultiplier,
} from "@/lib/battle/enemy-turn-rules";
import { makeTestBattleState } from "../../fixtures/battle";

describe("enemy turn rules", () => {
  it("keeps scaling and freeze checks pure", () => {
    const state = makeTestBattleState({
      turn: 2,
      roomScalingMultiplier: 1.5,
      enemyCC: { ...makeTestBattleState().enemyCC, freezeSkipTurns: 1 },
      talentEffects: { ...makeTestBattleState().talentEffects, freezeBlocksRegen: true },
    });
    expect(isEveryOtherTurnScalingTurn(state)).toBe(true);
    expect(scaleByRoomMultiplier(state, 3)).toBe(5);
    expect(isFreezeActiveForAspect(state, "regen")).toBe(true);
  });
});
