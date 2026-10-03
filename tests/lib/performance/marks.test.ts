import { afterEach, describe, expect, it, vi } from "vitest";
import { STARTUP_READY_MARK, battleStageMarkName, markBattleStage, markStartupReady } from "@/lib/performance/marks";

afterEach(() => {
  performance.clearMarks(STARTUP_READY_MARK);
  for (const stage of [
    "discard-start",
    "discard-end",
    "resolve-start",
    "resolve-end",
    "enemy-start",
    "enemy-end",
    "draw-start",
    "draw-end",
  ] as const) {
    performance.clearMarks(battleStageMarkName(stage));
  }
  vi.restoreAllMocks();
});

describe("performance marks", () => {
  it("records marks idempotently and swallows exceptions", () => {
    markStartupReady();
    markStartupReady();
    expect(performance.getEntriesByName(STARTUP_READY_MARK, "mark")).toHaveLength(1);
    markBattleStage("enemy-start");
    expect(performance.getEntriesByName("alchemy:battle:enemy-start", "mark")).toHaveLength(1);
    vi.spyOn(performance, "mark").mockImplementation(() => {
      throw new Error("mark failed");
    });
    expect(() => markStartupReady()).not.toThrow();
    expect(() => markBattleStage("draw-start")).not.toThrow();
  });

  it("swallows User Timing read failures", () => {
    vi.spyOn(performance, "getEntriesByName").mockImplementation(() => {
      throw new Error("unavailable");
    });
    expect(() => markStartupReady()).not.toThrow();
  });
});
