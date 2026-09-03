export function isDeltaNoisy(delta: number, se: number, k = 2): boolean {
  return se > 0 && Math.abs(delta) < k * se;
}

export interface RateCell {
  winRate: number;
  timeoutRate: number;
  averageTurns: number;
  averageHealthRemaining: number;
  n: number;
}

export function emptyRateCell(): RateCell {
  return { winRate: 0, timeoutRate: 0, averageTurns: 0, averageHealthRemaining: 0, n: 0 };
}

export function combineRateCells(cells: readonly RateCell[]): RateCell {
  if (cells.length === 0) return emptyRateCell();
  let n = 0;
  let wins = 0;
  let timeouts = 0;
  let turns = 0;
  let health = 0;
  for (const cell of cells) {
    n += cell.n;
    wins += cell.winRate * cell.n;
    timeouts += cell.timeoutRate * cell.n;
    turns += cell.averageTurns * cell.n;
    health += cell.averageHealthRemaining * cell.n;
  }
  if (n === 0) return emptyRateCell();
  return {
    winRate: wins / n,
    timeoutRate: timeouts / n,
    averageTurns: turns / n,
    averageHealthRemaining: health / n,
    n,
  };
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
  return stats.reduce(
    (combined, entry) => ({
      n: combined.n + entry.n,
      treatmentWins: combined.treatmentWins + entry.treatmentWins,
      baselineWins: combined.baselineWins + entry.baselineWins,
      squaredDifferenceSum: combined.squaredDifferenceSum + entry.squaredDifferenceSum,
      treatmentTurns: combined.treatmentTurns + entry.treatmentTurns,
      baselineTurns: combined.baselineTurns + entry.baselineTurns,
      squaredTurnDifferenceSum: combined.squaredTurnDifferenceSum + entry.squaredTurnDifferenceSum,
    }),
    emptyPairedWinStats(),
  );
}

export function makePairedDelta(id: string, stats: PairedWinStats): PairedDelta {
  if (stats.n === 0) {
    return {
      id,
      delta: 0,
      winRate: 0,
      baseline: 0,
      se: 0,
      turnDelta: 0,
      baselineTurns: 0,
      treatmentTurns: 0,
      turnSe: 0,
      n: 0,
      noisy: true,
    };
  }
  const winRate = stats.treatmentWins / stats.n;
  const baseline = stats.baselineWins / stats.n;
  const differenceSum = stats.treatmentWins - stats.baselineWins;
  const delta = differenceSum / stats.n;
  const sampleVariance =
    stats.n > 1
      ? Math.max(0, (stats.squaredDifferenceSum - (differenceSum * differenceSum) / stats.n) / (stats.n - 1))
      : 0;
  const se = stats.n > 1 ? Math.sqrt(sampleVariance / stats.n) : 0;

  const treatmentTurns = stats.treatmentTurns / stats.n;
  const baselineTurns = stats.baselineTurns / stats.n;
  const turnDiffSum = stats.treatmentTurns - stats.baselineTurns;
  const turnDelta = turnDiffSum / stats.n;
  const turnVariance =
    stats.n > 1
      ? Math.max(0, (stats.squaredTurnDifferenceSum - (turnDiffSum * turnDiffSum) / stats.n) / (stats.n - 1))
      : 0;
  const turnSe = stats.n > 1 ? Math.sqrt(turnVariance / stats.n) : 0;

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
