import { describe, expect, it } from "vitest";
import { formatCompareNumber, renderComparisonTable, checkEnvironmentCompatibility } from "../../performance/compare";

describe("performance compare helpers", () => {
  it("formats numbers and comparison tables from one owner", () => {
    expect(formatCompareNumber(1.234)).toBe("1.23");
    expect(formatCompareNumber(Number.NaN)).toBe("n/a");
    const table = renderComparisonTable([
      {
        key: "p99FrameTime",
        label: "p99",
        before: 20,
        after: 18,
        delta: -2,
        percentChange: -10,
        higherIsBetter: false,
        improved: true,
      },
    ]);
    expect(table[0]).toContain("| Metric | Before | After |");
    expect(table[2]).toContain("| p99 | 20.00 | 18.00 | -2.00 improved | -10.0% |");
  });

  it("rejects runs-per-scenario mismatches", () => {
    const base = {
      runtime: "chromium" as const,
      traceMode: false,
      coldMode: false,
      platform: "darwin",
      runsPerScenario: 1,
    };
    expect(checkEnvironmentCompatibility({ ...base }, { ...base, runsPerScenario: 3 }).compatible).toBe(false);
    expect(checkEnvironmentCompatibility({ ...base }, { ...base }).compatible).toBe(true);
  });
});
