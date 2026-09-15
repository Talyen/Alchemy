export function isDeltaNoisy(delta: number, se: number, k = 2): boolean {
  return se > 0 && Math.abs(delta) < k * se;
}

export interface RateCell {
  wins: number;
  losses: number;
  timeouts: number;
  winRate: number;
  timeoutRate: number;
  averageTurns: number;
  averageEnemyAttacks: number;
  averageEnemyAbilityActivations: number;
  averageEnemyAbilityUses: number;
  winsBeforeEnemyAttackRate: number;
  averageHealthRemaining: number;
  n: number;
}

export function emptyRateCell(): RateCell {
  return {
    wins: 0,
    losses: 0,
    timeouts: 0,
    winRate: 0,
    timeoutRate: 0,
    averageTurns: 0,
    averageHealthRemaining: 0,
    averageEnemyAttacks: 0,
    averageEnemyAbilityActivations: 0,
    averageEnemyAbilityUses: 0,
    winsBeforeEnemyAttackRate: 0,
    n: 0,
  };
}

export function combineRateCells(cells: readonly RateCell[]): RateCell {
  if (cells.length === 0) return emptyRateCell();
  let n = 0;
  let winsTotal = 0;
  let lossesTotal = 0;
  let timeoutsTotal = 0;
  let winRateWeighted = 0;
  let timeoutRateWeighted = 0;
  let turnsWeighted = 0;
  let healthWeighted = 0;
  let attacksWeighted = 0;
  let abilityUsesWeighted = 0;
  let abilityActivationsWeighted = 0;
  let winsBeforeAttackWeighted = 0;

  for (const cell of cells) {
    const weight = cell.n;
    n += weight;
    winsTotal += cell.wins;
    lossesTotal += cell.losses;
    timeoutsTotal += cell.timeouts;
    winRateWeighted += cell.winRate * weight;
    timeoutRateWeighted += cell.timeoutRate * weight;
    turnsWeighted += cell.averageTurns * weight;
    healthWeighted += cell.averageHealthRemaining * weight;
    attacksWeighted += cell.averageEnemyAttacks * weight;
    abilityUsesWeighted += cell.averageEnemyAbilityUses * weight;
    abilityActivationsWeighted += cell.averageEnemyAbilityActivations * weight;
    winsBeforeAttackWeighted += cell.winsBeforeEnemyAttackRate * weight;
  }

  if (n === 0) return emptyRateCell();
  return {
    wins: winsTotal,
    losses: lossesTotal,
    timeouts: timeoutsTotal,
    winRate: winRateWeighted / n,
    timeoutRate: timeoutRateWeighted / n,
    averageTurns: turnsWeighted / n,
    averageEnemyAttacks: attacksWeighted / n,
    averageEnemyAbilityUses: abilityUsesWeighted / n,
    averageEnemyAbilityActivations: abilityActivationsWeighted / n,
    winsBeforeEnemyAttackRate: winsBeforeAttackWeighted / n,
    averageHealthRemaining: healthWeighted / n,
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
