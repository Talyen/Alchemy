import { describe, expect, it } from "vitest";
import { equalWeightByType } from "@/lib/balance/report-run";
import type { RateCell } from "@/lib/balance/report-rankings";

function rate(winRate: number, n: number): RateCell {
  return {
    winRate,
    timeoutRate: winRate / 10,
    averageTurns: winRate * 10,
    averageHealthRemaining: winRate * 20,
    n,
  };
}

describe("equalWeightByType", () => {
  it("weights enemy types equally while retaining the underlying sample count", () => {
    const combined = equalWeightByType({
      normal: rate(0.9, 900),
      elite: rate(0.6, 60),
      boss: rate(0.3, 3),
    });

    expect(combined.winRate).toBeCloseTo(0.6);
    expect(combined.timeoutRate).toBeCloseTo(0.06);
    expect(combined.n).toBe(963);
  });
});
