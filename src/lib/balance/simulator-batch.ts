import { summarizeBattleRates } from "./rate-statistics";
import { DEFAULT_SEED, simulateBattle } from "./simulator";
import type { BalanceBatchConfig, BalanceBatchResult } from "./simulator-types";

function assertPositiveIterations(iterations: number): void {
  if (!Number.isSafeInteger(iterations) || iterations <= 0) {
    throw new Error(`iterations must be a positive integer; received ${iterations}`);
  }
}

function forEachSimulation(
  config: BalanceBatchConfig,
  visit: (result: ReturnType<typeof simulateBattle>) => void,
): void {
  assertPositiveIterations(config.iterations);
  const baseSeed = config.seed ?? DEFAULT_SEED;
  for (let index = 0; index < config.iterations; index += 1) {
    visit(simulateBattle({ ...config, seed: baseSeed + index }));
  }
}

export function simulateBatch(config: BalanceBatchConfig): BalanceBatchResult {
  let cardsPlayedTotal = 0;
  const cardPlayCounts: Record<string, number> = {};
  const results: BalanceBatchResult["results"] = [];

  forEachSimulation(config, (result) => {
    results.push(result);
    cardsPlayedTotal += result.totalCardsPlayed;
    for (const [cardId, count] of Object.entries(result.cardsPlayed)) {
      cardPlayCounts[cardId] = (cardPlayCounts[cardId] ?? 0) + count;
    }
  });

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
  const outcomes = new Uint8Array(config.iterations);
  const turns = new Uint16Array(config.iterations);
  let wins = 0;
  let totalTurns = 0;
  let index = 0;
  forEachSimulation({ ...config, trackAnomalies: false, trackMetrics: false }, (result) => {
    turns[index] = result.turns;
    totalTurns += result.turns;
    if (result.outcome === "win") {
      outcomes[index] = 1;
      wins += 1;
    }
    index += 1;
  });
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
