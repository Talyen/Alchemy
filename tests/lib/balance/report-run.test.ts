import { describe, expect, it } from "vitest";
import { equalWeightByType } from "@/lib/balance/report-run";
import type { RateCell } from "@/lib/balance/report-rankings";

function rate(winRate: number, n: number): RateCell {
  return {
    wins: Math.round(winRate * n),
    losses: n - Math.round(winRate * n) - Math.round((winRate / 10) * n),
    timeouts: Math.round((winRate / 10) * n),
    winRate,
    timeoutRate: winRate / 10,
    averageEnemyAttacks: 0,
    averageEnemyAbilityActivations: 0,
    averageEnemyAbilityUses: 0,
    winsBeforeEnemyAttackRate: 0,
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
    expect(combined.wins).toBe(847);
    expect(combined.losses).toBe(31);
    expect(combined.timeouts).toBe(85);
  });
});
