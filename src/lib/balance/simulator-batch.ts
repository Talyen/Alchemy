import { DEFAULT_SEED, simulateBattle } from "./simulator";
import type { BalanceBatchConfig, BalanceBatchResult } from "./simulator-types";

function runBatchInternal(config: BalanceBatchConfig): BalanceBatchResult {
  const baseSeed = config.seed ?? DEFAULT_SEED;
  let wins = 0;
  let losses = 0;
  let timeouts = 0;
  let turnTotal = 0;
  let healthTotal = 0;
  let cardsPlayedTotal = 0;
  const cardPlayCounts: Record<string, number> = {};
  const results: BalanceBatchResult["results"] = [];

  for (let index = 0; index < config.iterations; index += 1) {
    const result = simulateBattle({ ...config, seed: baseSeed + index });
    results.push(result);
    if (result.outcome === "win") wins += 1;
    else if (result.outcome === "loss") losses += 1;
    else timeouts += 1;
    turnTotal += result.turns;
    healthTotal += Math.max(0, result.playerHealth);
    cardsPlayedTotal += result.totalCardsPlayed;
    for (const [cardId, count] of Object.entries(result.cardsPlayed)) {
      cardPlayCounts[cardId] = (cardPlayCounts[cardId] ?? 0) + count;
    }
  }

  const iterations = config.iterations;
  return {
    config,
    iterations,
    wins,
    losses,
    timeouts,
    winRate: wins / iterations,
    lossRate: losses / iterations,
    timeoutRate: timeouts / iterations,
    averageTurns: turnTotal / iterations,
    averageHealthRemaining: healthTotal / iterations,
    averageCardsPlayed: cardsPlayedTotal / iterations,
    cardPlayCounts,
    results,
  };
}

export function simulateBatch(config: BalanceBatchConfig): BalanceBatchResult {
  return runBatchInternal(config);
}

export interface WinSeries {
  outcomes: Uint8Array;
  wins: number;
  iterations: number;
  winRate: number;
}

export function simulateWinSeries(config: BalanceBatchConfig): WinSeries {
  const baseSeed = config.seed ?? DEFAULT_SEED;
  const outcomes = new Uint8Array(config.iterations);
  let wins = 0;
  for (let index = 0; index < config.iterations; index += 1) {
    if (simulateBattle({ ...config, seed: baseSeed + index }).outcome !== "win") continue;
    outcomes[index] = 1;
    wins += 1;
  }
  return { outcomes, wins, iterations: config.iterations, winRate: wins / config.iterations };
}
