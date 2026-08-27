import { describe, it, expect } from "vitest";
import { simulateBatch, simulateBatchSummary } from "@/lib/balance/simulator-batch";
import type { BalanceBatchConfig } from "@/lib/balance/simulator-types";

describe("simulateBatch streaming equivalence", () => {
  it("summary and detailed produce identical aggregate metrics", () => {
    const config: BalanceBatchConfig = {
      characterId: "knight",
      enemyId: "skeleton",
      iterations: 50,
      seed: 12345,
      talentPreset: "early",
      policy: "random-playable",
    };

    const detailed = simulateBatch(config);
    const summary = simulateBatchSummary(config);

    expect(summary.iterations).toBe(detailed.iterations);
    expect(summary.wins).toBe(detailed.wins);
    expect(summary.losses).toBe(detailed.losses);
    expect(summary.timeouts).toBe(detailed.timeouts);
    expect(summary.winRate).toBe(detailed.winRate);
    expect(summary.lossRate).toBe(detailed.lossRate);
    expect(summary.timeoutRate).toBe(detailed.timeoutRate);
    expect(summary.averageTurns).toBe(detailed.averageTurns);
    expect(summary.averageHealthRemaining).toBe(detailed.averageHealthRemaining);
    expect(summary.averageCardsPlayed).toBe(detailed.averageCardsPlayed);
    expect(summary.cardPlayCounts).toEqual(detailed.cardPlayCounts);
    expect(summary.results).toEqual([]);
    expect(detailed.results).toHaveLength(50);
  });

  it("summary works for different presets and policies", () => {
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
      const detailed = simulateBatch(config);
      const summary = simulateBatchSummary(config);
      expect(summary.winRate).toBe(detailed.winRate);
      expect(summary.cardPlayCounts).toEqual(detailed.cardPlayCounts);
    }
  });
});
