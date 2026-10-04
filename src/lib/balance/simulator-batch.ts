import { summarizeBattleRates } from "./rate-statistics";
import { DEFAULT_SEED, simulateBattle } from "./simulator";
import type { BalanceBatchConfig, BalanceBatchResult } from "./simulator-types";

function assertPositiveIterations(iterations: number): void {
  if (!Number.isSafeInteger(iterations) || iterations <= 0) {
    throw new Error(`iterations must be a positive integer; received ${iterations}`);
  }
}

export function simulateBatch(config: BalanceBatchConfig): BalanceBatchResult {
  assertPositiveIterations(config.iterations);
  const baseSeed = config.seed ?? DEFAULT_SEED;
  let cardsPlayedTotal = 0;
  const cardPlayCounts: Record<string, number> = {};
  const results: BalanceBatchResult["results"] = [];

  for (let index = 0; index < config.iterations; index += 1) {
    const result = simulateBattle({ ...config, seed: baseSeed + index });
    results.push(result);
    cardsPlayedTotal += result.totalCardsPlayed;
    for (const [cardId, count] of Object.entries(result.cardsPlayed)) {
      cardPlayCounts[cardId] = (cardPlayCounts[cardId] ?? 0) + count;
    }
  }

  const { n: iterations, ...rates } = summarizeBattleRates(results);
  return {
    config,
    iterations,
    ...rates,
    lossRate: rates.losses / iterations,
    averageCardsPlayed: cardsPlayedTotal / iterations,
    cardPlayCounts,
    results,
  };
}

export interface WinSeries {
  outcomes: Uint8Array;
  turns: Uint16Array;
  wins: number;
  iterations: number;
  winRate: number;
  totalTurns: number;
  averageTurns: number;
}

export function simulateWinSeries(config: BalanceBatchConfig): WinSeries {
  assertPositiveIterations(config.iterations);
  const baseSeed = config.seed ?? DEFAULT_SEED;
  const outcomes = new Uint8Array(config.iterations);
  const turns = new Uint16Array(config.iterations);
  let wins = 0;
  let totalTurns = 0;
  for (let index = 0; index < config.iterations; index += 1) {
    const result = simulateBattle({ ...config, seed: baseSeed + index, trackAnomalies: false, trackMetrics: false });
    turns[index] = result.turns;
    totalTurns += result.turns;
    if (result.outcome === "win") {
      outcomes[index] = 1;
      wins += 1;
    }
  }
  return {
    outcomes,
    turns,
    wins,
    iterations: config.iterations,
    winRate: wins / config.iterations,
    totalTurns,
    averageTurns: totalTurns / config.iterations,
  };
}
