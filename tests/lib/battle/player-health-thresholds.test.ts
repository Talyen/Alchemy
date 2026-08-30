import { describe, expect, it } from "vitest";
import { checkHealthThresholds } from "@/lib/battle/player-health-thresholds";
import { makeTestBattleState } from "../../fixtures/battle";

describe("player health thresholds", () => {
  it("applies a configured bonus only when health crosses its threshold", () => {
    const base = makeTestBattleState();
    const state = makeTestBattleState({
      playerMaxHealth: 30,
      talentEffects: { ...base.talentEffects, healthThresholdBlock: { threshold: 50, amount: 4 } },
    });
    expect(checkHealthThresholds(20, 10, state, []).playerStatuses.block).toBe(4);
    expect(checkHealthThresholds(10, 9, state, [])).toBe(state);
  });
});
