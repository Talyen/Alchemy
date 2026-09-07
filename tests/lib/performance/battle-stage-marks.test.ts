import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BATTLE_STAGE_MARK_PREFIX,
  battleStageMarkName,
  markBattleStage,
  clearBattleStageMarks,
  type BattleStageMark,
} from "@/lib/performance/battle-stage-marks";

const ALL_STAGES: BattleStageMark[] = [
  "discard-start",
  "discard-end",
  "resolve-start",
  "resolve-end",
  "enemy-start",
  "enemy-end",
  "draw-start",
  "draw-end",
];

afterEach(() => {
  for (const stage of ALL_STAGES) {
    performance.clearMarks(battleStageMarkName(stage));
  }
  vi.restoreAllMocks();
});

describe("battle stage marks", () => {
  it("builds prefixed mark names", () => {
    expect(BATTLE_STAGE_MARK_PREFIX).toBe("alchemy:battle:");
    for (const stage of ALL_STAGES) {
      expect(battleStageMarkName(stage)).toBe(`alchemy:battle:${stage}`);
    }
  });

  it("records performance marks for valid stages", () => {
    markBattleStage("resolve-start");
    markBattleStage("resolve-end");
    expect(performance.getEntriesByName("alchemy:battle:resolve-start", "mark")).toHaveLength(1);
    expect(performance.getEntriesByName("alchemy:battle:resolve-end", "mark")).toHaveLength(1);
  });

  it("clears every battle stage while preserving unrelated marks", () => {
    performance.mark("unrelated-test-mark");
    for (const stage of ALL_STAGES) {
      markBattleStage(stage);
      markBattleStage(stage);
    }
    clearBattleStageMarks();
    for (const stage of ALL_STAGES)
      expect(performance.getEntriesByName(battleStageMarkName(stage), "mark")).toHaveLength(0);
    expect(performance.getEntriesByName("unrelated-test-mark", "mark")).toHaveLength(1);
    performance.clearMarks("unrelated-test-mark");
  });

  it("tolerates unavailable User Timing cleanup", () => {
    vi.spyOn(performance, "clearMarks").mockImplementation(() => {
      throw new Error("Unavailable");
    });
    expect(() => clearBattleStageMarks()).not.toThrow();
    vi.restoreAllMocks();
  });

  it("swallows User Timing exceptions safely", () => {
    vi.spyOn(performance, "mark").mockImplementation(() => {
      throw new Error("Performance.mark failed");
    });
    expect(() => markBattleStage("enemy-start")).not.toThrow();
  });
});
