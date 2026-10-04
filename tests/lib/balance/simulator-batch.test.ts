import { describe, it, expect } from "vitest";
import { simulateBatch, simulateWinSeries } from "@/lib/balance/simulator-batch";
import type { BalanceBatchConfig } from "@/lib/balance/simulator-types";

describe("simulateWinSeries", () => {
  it.each([0, -1, 1.5, Number.POSITIVE_INFINITY])("rejects invalid iteration counts: %s", (iterations) => {
    const config: BalanceBatchConfig = {
      characterId: "knight",
      enemyId: "skeleton",
      iterations,
    };

    expect(() => simulateBatch(config)).toThrow("iterations must be a positive integer");
    expect(() => simulateWinSeries(config)).toThrow("iterations must be a positive integer");
  });

  it("matches detailed win totals without retaining battle results", () => {
    const config: BalanceBatchConfig = {
      characterId: "knight",
      enemyId: "skeleton",
      iterations: 12,
      seed: 12345,
      talentPreset: "early",
      policy: "random-playable",
    };

    const detailed = simulateBatch(config);
    const series = simulateWinSeries(config);

    expect(series.iterations).toBe(detailed.iterations);
    expect(series.wins).toBe(detailed.wins);
    expect(series.winRate).toBe(detailed.winRate);
    expect([...series.outcomes]).toEqual(detailed.results.map((result) => Number(result.outcome === "win")));
    expect([...series.turns]).toEqual(detailed.results.map((result) => result.turns));
    expect(series.totalTurns).toBe(detailed.results.reduce((sum, result) => sum + result.turns, 0));
    expect(series.averageTurns).toBe(detailed.averageTurns);
    expect(detailed.results).toHaveLength(config.iterations);
    const mean = (read: (result: (typeof detailed.results)[number]) => number) =>
      detailed.results.reduce((sum, result) => sum + read(result), 0) / detailed.iterations;
    expect(detailed).toMatchObject({
      wins: detailed.results.filter((result) => result.outcome === "win").length,
      losses: detailed.results.filter((result) => result.outcome === "loss").length,
      timeouts: detailed.results.filter((result) => result.outcome === "timeout").length,
      averageTurns: mean((result) => result.turns),
      averageHealthRemaining: mean((result) => Math.max(0, result.playerHealth)),
      averageEnemyAttacks: mean((result) => result.enemyAttackActions),
      averageEnemyAbilityUses: mean((result) => Object.values(result.enemyAbilityUses).reduce((a, b) => a + b, 0)),
      averageEnemyAbilityActivations: mean((result) =>
        Object.values(result.enemyAbilityActivations).reduce((a, b) => a + b, 0),
      ),
      winsBeforeEnemyAttackRate: mean((result) => Number(result.wonBeforeEnemyAttack)),
    });
  });
});
