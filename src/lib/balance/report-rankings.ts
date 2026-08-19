// Ranking, pairing, and sample-noise helpers for balance reports.

export function proportionSE(rate: number, n: number): number {
  if (n <= 0) return 0;
  return Math.sqrt((rate * (1 - rate)) / n);
}

export function pairedDeltaSE(treatmentRate: number, baselineRate: number, n: number): number {
  return Math.hypot(proportionSE(treatmentRate, n), proportionSE(baselineRate, n));
}

export function isDeltaNoisy(delta: number, se: number, k = 2): boolean {
  return se > 0 && Math.abs(delta) < k * se;
}

export function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
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
  n: number;
  noisy: boolean;
}

export function makePairedDelta(id: string, winRate: number, baseline: number, n: number): PairedDelta {
  const delta = winRate - baseline;
  const se = pairedDeltaSE(winRate, baseline, n);
  return { id, delta, winRate, baseline, se, n, noisy: isDeltaNoisy(delta, se) };
}

export function topPlayedCards(counts: Record<string, number>, limit = 5): Array<{ cardId: string; count: number }> {
  return Object.entries(counts)
    .map(([cardId, count]) => ({ cardId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
