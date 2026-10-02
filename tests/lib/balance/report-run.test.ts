import { describe, expect, it } from "vitest";
import { equalWeightByType } from "@/lib/balance/report-run";
import { emptyRateCell, type RateCell } from "@/lib/balance/report-rankings";

function rate(winRate: number, n: number): RateCell {
  return {
    wins: Math.round(winRate * n),
    losses: n - Math.round(winRate * n) - Math.round((winRate / 10) * n),
    timeouts: Math.round((winRate / 10) * n),
    winRate,
    timeoutRate: winRate / 10,
    averageEnemyAttacks: winRate * 5,
    averageEnemyAbilityActivations: winRate * 3,
    averageEnemyAbilityUses: winRate * 7,
    winsBeforeEnemyAttackRate: winRate / 2,
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
    expect(combined.averageTurns).toBeCloseTo(6);
    expect(combined.averageHealthRemaining).toBeCloseTo(12);
    expect(combined.averageEnemyAttacks).toBeCloseTo(3);
    expect(combined.averageEnemyAbilityActivations).toBeCloseTo(1.8);
    expect(combined.averageEnemyAbilityUses).toBeCloseTo(4.2);
    expect(combined.winsBeforeEnemyAttackRate).toBeCloseTo(0.3);
    expect(combined.n).toBe(963);
    expect(combined.wins).toBe(847);
    expect(combined.losses).toBe(31);
    expect(combined.timeouts).toBe(85);
  });

  it("excludes unsampled enemy types without changing the sampled type", () => {
    const normal = rate(0.9, 10);
    const combined = equalWeightByType({ normal, elite: emptyRateCell(), boss: emptyRateCell() });
    expect(combined).toEqual(normal);
    expect(combined).not.toBe(normal);
    expect(equalWeightByType({ normal: emptyRateCell(), elite: emptyRateCell(), boss: emptyRateCell() })).toEqual(
      emptyRateCell(),
    );
  });
});
