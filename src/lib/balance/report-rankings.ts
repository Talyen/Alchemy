export type { RateCell } from "./simulator-types";
export { emptyRateCell, combineRateCells } from "./rate-statistics";

export function isDeltaNoisy(delta: number, se: number, k = 2): boolean {
  return se > 0 && Math.abs(delta) < k * se;
}

export interface PairedDelta {
  id: string;
  delta: number;
  winRate: number;
  baseline: number;
  se: number;
  turnDelta: number;
  baselineTurns: number;
  treatmentTurns: number;
  turnSe: number;
  n: number;
  noisy: boolean;
}

export interface PairedWinStats {
  n: number;
  treatmentWins: number;
  baselineWins: number;
  squaredDifferenceSum: number;
  treatmentTurns: number;
  baselineTurns: number;
  squaredTurnDifferenceSum: number;
}

export function emptyPairedWinStats(): PairedWinStats {
  return {
    n: 0,
    treatmentWins: 0,
    baselineWins: 0,
    squaredDifferenceSum: 0,
    treatmentTurns: 0,
    baselineTurns: 0,
    squaredTurnDifferenceSum: 0,
  };
}

export function pairedWinStats(
  baseline: Uint8Array,
  treatment: Uint8Array,
  baselineTurns?: Uint16Array,
  treatmentTurns?: Uint16Array,
): PairedWinStats {
  if (baseline.length !== treatment.length) {
    throw new Error(`paired win series must have equal lengths; received ${baseline.length} and ${treatment.length}`);
  }
  if (
    (baselineTurns === undefined) !== (treatmentTurns === undefined) ||
    (baselineTurns && baselineTurns.length !== baseline.length) ||
    (treatmentTurns && treatmentTurns.length !== treatment.length)
  ) {
    throw new Error("paired turn series must both be present and match outcome lengths");
  }
  const stats = emptyPairedWinStats();
  stats.n = baseline.length;
  for (let index = 0; index < baseline.length; index += 1) {
    const baselineWin = baseline[index] ?? 0;
    const treatmentWin = treatment[index] ?? 0;
    stats.baselineWins += baselineWin;
    stats.treatmentWins += treatmentWin;
    const difference = treatmentWin - baselineWin;
    stats.squaredDifferenceSum += difference * difference;

    if (baselineTurns && treatmentTurns) {
      const bTurn = baselineTurns[index] ?? 0;
      const tTurn = treatmentTurns[index] ?? 0;
      stats.baselineTurns += bTurn;
      stats.treatmentTurns += tTurn;
      const turnDiff = tTurn - bTurn;
      stats.squaredTurnDifferenceSum += turnDiff * turnDiff;
    }
  }
  return stats;
}

export function combinePairedWinStats(stats: readonly PairedWinStats[]): PairedWinStats {
  const combined = emptyPairedWinStats();
  for (const entry of stats) {
    combined.n += entry.n;
    combined.treatmentWins += entry.treatmentWins;
    combined.baselineWins += entry.baselineWins;
    combined.squaredDifferenceSum += entry.squaredDifferenceSum;
    combined.treatmentTurns += entry.treatmentTurns;
    combined.baselineTurns += entry.baselineTurns;
    combined.squaredTurnDifferenceSum += entry.squaredTurnDifferenceSum;
  }
  return combined;
}

function pairedStandardError(n: number, differenceSum: number, squaredDifferenceSum: number): number {
  if (n <= 1) return 0;
  const variance = Math.max(0, (squaredDifferenceSum - (differenceSum * differenceSum) / n) / (n - 1));
  return Math.sqrt(variance / n);
}

export function makePairedDelta(id: string, stats: PairedWinStats): PairedDelta {
  // Empty samples use the same result shape and finite zero measurements.
  const mean = (total: number) => (stats.n === 0 ? 0 : total / stats.n);
  const winRate = mean(stats.treatmentWins);
  const baseline = mean(stats.baselineWins);
  const differenceSum = stats.treatmentWins - stats.baselineWins;
  const delta = mean(differenceSum);
  const se = pairedStandardError(stats.n, differenceSum, stats.squaredDifferenceSum);

  const treatmentTurns = mean(stats.treatmentTurns);
  const baselineTurns = mean(stats.baselineTurns);
  const turnDiffSum = stats.treatmentTurns - stats.baselineTurns;
  const turnDelta = mean(turnDiffSum);
  const turnSe = pairedStandardError(stats.n, turnDiffSum, stats.squaredTurnDifferenceSum);

  return {
    id,
    delta,
    winRate,
    baseline,
    se,
    turnDelta,
    baselineTurns,
    treatmentTurns,
    turnSe,
    n: stats.n,
    noisy: stats.n < 2 || isDeltaNoisy(delta, se),
  };
}

export function topPlayedCards(counts: Record<string, number>, limit = 5): Array<{ cardId: string; count: number }> {
  return Object.entries(counts)
    .map(([cardId, count]) => ({ cardId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
