import { describe, it, expect } from "vitest";
import { simulateBatch, simulateWinSeries } from "@/lib/balance/simulator-batch";
import type { BalanceBatchConfig } from "@/lib/balance/simulator-types";

describe("simulateWinSeries", () => {
  it("matches detailed win totals without retaining battle results", () => {
    const config: BalanceBatchConfig = {
      characterId: "knight",
      enemyId: "skeleton",
      iterations: 50,
      seed: 12345,
      talentPreset: "early",
      policy: "random-playable",
    };

    const detailed = simulateBatch(config);
    const series = simulateWinSeries(config);

    expect(series.iterations).toBe(detailed.iterations);
    expect(series.wins).toBe(detailed.wins);
    expect(series.winRate).toBe(detailed.winRate);
    expect(series.outcomes).toHaveLength(50);
    expect([...series.outcomes].every((outcome) => outcome === 0 || outcome === 1)).toBe(true);
    expect(detailed.results).toHaveLength(50);
  });

  it("is deterministic across presets and policies", () => {
    const configs: BalanceBatchConfig[] = [
      {
        characterId: "wizard",
        enemyId: "mimic",
        iterations: 20,
        seed: 999,
        talentPreset: "mid",
        policy: "greedy-damage",
      },
      {
        characterId: "ranger",
        enemyId: "iron-bear",
        iterations: 30,
        seed: 1,
        talentPreset: "late",
        policy: "defensive-random",
      },
    ];
    for (const config of configs) {
      const first = simulateWinSeries(config);
      const second = simulateWinSeries(config);
      expect(second).toEqual(first);
    }
  });
});
