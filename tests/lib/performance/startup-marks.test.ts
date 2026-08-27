import { afterEach, describe, expect, it, vi } from "vitest";
import { STARTUP_READY_MARK, markStartupReady } from "@/lib/performance/startup-marks";

afterEach(() => {
  performance.clearMarks(STARTUP_READY_MARK);
  vi.restoreAllMocks();
});

describe("startup marks", () => {
  it("records renderer-ready once", () => {
    markStartupReady();
    markStartupReady();
    expect(performance.getEntriesByName(STARTUP_READY_MARK, "mark")).toHaveLength(1);
  });

  it("swallows User Timing failures", () => {
    vi.spyOn(performance, "getEntriesByName").mockImplementation(() => {
      throw new Error("unavailable");
    });
    expect(() => markStartupReady()).not.toThrow();
  });
});
