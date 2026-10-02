import type { BalanceBatchResult, BattleSimulationResult, RateCell } from "./simulator-types";

// Counts always retain actual battles; rates and averages use the caller's
// weighting. Every reported measurement has one extraction and aggregation rule.
const RATE_METRICS = {
  wins: { kind: "count", read: (result) => Number(result.outcome === "win") },
  losses: { kind: "count", read: (result) => Number(result.outcome === "loss") },
  timeouts: { kind: "count", read: (result) => Number(result.outcome === "timeout") },
  winRate: { kind: "mean", read: (result) => Number(result.outcome === "win") },
  timeoutRate: { kind: "mean", read: (result) => Number(result.outcome === "timeout") },
  averageTurns: { kind: "mean", read: (result) => result.turns },
  averageEnemyAttacks: { kind: "mean", read: (result) => result.enemyAttackActions },
  averageEnemyAbilityActivations: { kind: "mean", read: (result) => sumCounts(result.enemyAbilityActivations) },
  averageEnemyAbilityUses: { kind: "mean", read: (result) => sumCounts(result.enemyAbilityUses) },
  winsBeforeEnemyAttackRate: { kind: "mean", read: (result) => Number(result.wonBeforeEnemyAttack) },
  averageHealthRemaining: { kind: "mean", read: (result) => Math.max(0, result.playerHealth) },
  n: { kind: "count", read: () => 1 },
} satisfies Record<keyof RateCell, { kind: "count" | "mean"; read: (result: BattleSimulationResult) => number }>;

// Object.keys loses the known keys; the exhaustive record above owns this cast.
const metricKeys = Object.keys(RATE_METRICS) as Array<keyof RateCell>;

function sumCounts(counts: Record<string, number>): number {
  return Object.values(counts).reduce((sum, count) => sum + count, 0);
}

export function emptyRateCell(): RateCell {
  const cell = {} as RateCell;
  for (const key of metricKeys) cell[key] = 0;
  return cell;
}

function normalizeMeans(totals: RateCell, weight: number): RateCell {
  if (weight === 0) return emptyRateCell();
  for (const key of metricKeys) {
    if (RATE_METRICS[key].kind === "mean") totals[key] /= weight;
  }
  return totals;
}

export function summarizeBattleRates(results: readonly BattleSimulationResult[]): RateCell {
  const totals = emptyRateCell();
  for (const result of results) {
    for (const key of metricKeys) totals[key] += RATE_METRICS[key].read(result);
  }
  return normalizeMeans(totals, totals.n);
}

export function rateCellFromBatch(batch: BalanceBatchResult): RateCell {
  const cell = emptyRateCell();
  for (const key of metricKeys) cell[key] = key === "n" ? batch.iterations : batch[key];
  return cell;
}

export function combineRateCells(cells: readonly RateCell[], weighting: "battles" | "groups" = "battles"): RateCell {
  if (weighting === "battles" && cells.length === 1) return { ...cells[0]! };
  const totals = emptyRateCell();
  let totalWeight = 0;
  for (const cell of cells) {
    // Empty enemy types must not dilute a class's equally weighted rates.
    if (weighting === "groups" && cell.n <= 0) continue;
    const weight = weighting === "battles" ? cell.n : 1;
    totalWeight += weight;
    for (const key of metricKeys) {
      totals[key] += cell[key] * (RATE_METRICS[key].kind === "mean" ? weight : 1);
    }
  }
  return normalizeMeans(totals, totalWeight);
}
