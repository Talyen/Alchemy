import { afterEach, describe, expect, it, vi } from "vitest";
import {
  STARTUP_READY_MARK,
  battleStageMarkName,
  clearBattleStageMarks,
  markBattleStage,
  markStartupReady,
  type BattleStageMark,
} from "@/lib/performance/marks";

const STAGES: BattleStageMark[] = [
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
  vi.restoreAllMocks();
  performance.clearMarks(STARTUP_READY_MARK);
  performance.clearMarks("unrelated-test-mark");
  clearBattleStageMarks();
});

describe("performance marks", () => {
  it("deduplicates startup while retaining repeated battle events and isolates their cleanup", () => {
    markStartupReady();
    markStartupReady();
    performance.mark("unrelated-test-mark");
    for (const stage of STAGES) {
      markBattleStage(stage);
      markBattleStage(stage);
      expect(performance.getEntriesByName(battleStageMarkName(stage), "mark")).toHaveLength(2);
    }
    clearBattleStageMarks();
    for (const stage of STAGES)
      expect(performance.getEntriesByName(battleStageMarkName(stage), "mark")).toHaveLength(0);
    expect(performance.getEntriesByName(STARTUP_READY_MARK, "mark")).toHaveLength(1);
    expect(performance.getEntriesByName("unrelated-test-mark", "mark")).toHaveLength(1);
  });

  it("keeps unsupported User Timing from interrupting startup or combat", () => {
    vi.spyOn(performance, "mark").mockImplementation(() => {
      throw new Error("unavailable");
    });
    expect(() => markStartupReady()).not.toThrow();
    expect(() => markBattleStage("draw-start")).not.toThrow();
    vi.spyOn(performance, "getEntriesByName").mockImplementation(() => {
      throw new Error("unavailable");
    });
    expect(() => markStartupReady()).not.toThrow();
    vi.spyOn(performance, "clearMarks").mockImplementation(() => {
      throw new Error("unavailable");
    });
    expect(() => clearBattleStageMarks()).not.toThrow();
  });
});
