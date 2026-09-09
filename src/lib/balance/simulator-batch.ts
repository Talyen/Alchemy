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

function runBatchInternal(config: BalanceBatchConfig): BalanceBatchResult {
  let wins = 0;
  let losses = 0;
  let timeouts = 0;
  let turnTotal = 0;
  let healthTotal = 0;
  let cardsPlayedTotal = 0;
  let enemyAttacksTotal = 0;
  let enemyAbilityActivationsTotal = 0;
  let enemyAbilityUsesTotal = 0;
  let winsBeforeEnemyAttack = 0;
  const cardPlayCounts: Record<string, number> = {};
  const results: BalanceBatchResult["results"] = [];

  forEachSimulation(config, (result) => {
    results.push(result);
    if (result.outcome === "win") wins += 1;
    else if (result.outcome === "loss") losses += 1;
    else timeouts += 1;
    turnTotal += result.turns;
    healthTotal += Math.max(0, result.playerHealth);
    cardsPlayedTotal += result.totalCardsPlayed;
    enemyAttacksTotal += result.enemyAttackActions;
    enemyAbilityUsesTotal += Object.values(result.enemyAbilityUses).reduce((a, b) => a + b, 0);
    enemyAbilityActivationsTotal += Object.values(result.enemyAbilityActivations).reduce((a, b) => a + b, 0);
    if (result.wonBeforeEnemyAttack) winsBeforeEnemyAttack += 1;
    for (const [cardId, count] of Object.entries(result.cardsPlayed)) {
      cardPlayCounts[cardId] = (cardPlayCounts[cardId] ?? 0) + count;
    }
  });

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
    averageEnemyAttacks: enemyAttacksTotal / iterations,
    averageEnemyAbilityActivations: enemyAbilityActivationsTotal / iterations,
    averageEnemyAbilityUses: enemyAbilityUsesTotal / iterations,
    winsBeforeEnemyAttackRate: winsBeforeEnemyAttack / iterations,
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
  forEachSimulation(config, (result) => {
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
