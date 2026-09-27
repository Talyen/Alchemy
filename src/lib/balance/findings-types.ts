import { ANOMALY_THRESHOLD_BY_PRESET } from "./anomalies";
import { DEFAULT_FINDINGS_CAP } from "./report-options";
import type { ReportEnemyType } from "./report-catalog";
import type { TalentPreset } from "./simulator-types";

export type EnemyTypeBand = ReportEnemyType;
export type FindingsTier = TalentPreset;

export const FINDINGS_CAP = DEFAULT_FINDINGS_CAP;
export const EQUITY_SPREAD = 0.15;
export const PAIRED_DELTA_FROM_MEDIAN = 0.15;
export const PAIRED_TURN_DELTA_THRESHOLD = 2.0;
export const MATCHUP_TURN_SPREAD_THRESHOLD = 2.5;
export const MATERIAL_TIMEOUT_RATE = 0.02;

export const LENGTH_BAND_BY_TYPE: Record<EnemyTypeBand, { min: number; max: number }> = {
  normal: { min: 5, max: 10 },
  elite: { min: 10, max: 15 },
  boss: { min: 15, max: 30 },
};

export const WIN_RATE_BAND_BY_TYPE: Record<EnemyTypeBand, { min: number; max: number }> = {
  normal: { min: 0.9, max: 0.999 },
  elite: { min: 0.8, max: 0.95 },
  boss: { min: 0.7, max: 0.999 },
};

export const ANOMALY_FINDING_THRESHOLDS = ANOMALY_THRESHOLD_BY_PRESET;

export function isWinRateFloorOrCeiling(winRate: number): boolean {
  return winRate <= 0 || winRate >= 1;
}

export function isLengthOutsideBand(turns: number, enemyType: EnemyTypeBand): boolean {
  const band = LENGTH_BAND_BY_TYPE[enemyType];
  return turns < band.min || turns > band.max;
}

export function isWinRateOutsideTypeBand(winRate: number, enemyType: EnemyTypeBand): boolean {
  if (isWinRateFloorOrCeiling(winRate)) return true;
  const band = WIN_RATE_BAND_BY_TYPE[enemyType];
  return winRate < band.min || winRate > band.max;
}

function formatPercentBand(min: number, max: number): string {
  return `${(min * 100).toFixed(0)}–${(max * 100).toFixed(1)}%`;
}

export function formatLengthBand(enemyType: EnemyTypeBand): string {
  const band = LENGTH_BAND_BY_TYPE[enemyType];
  return `${band.min}–${band.max} turns (${enemyType})`;
}

export function formatWinRateBand(enemyType: EnemyTypeBand): string {
  const band = WIN_RATE_BAND_BY_TYPE[enemyType];
  return `${formatPercentBand(band.min, band.max)} (${enemyType}, not 0/100)`;
}

export type FindingSeverity = "critical" | "serious" | "watch";
export type FindingScope =
  | "enemy"
  | "class"
  | "matchup"
  | "card"
  | "talent"
  | "companion"
  | "boon"
  | "gear"
  | "affix"
  | "anomaly";
export type FindingMetric = "winRate" | "averageTurns" | "timeoutRate" | "delta" | "anomaly";
export type FindingBucket = "timeout" | "floorCeiling" | "typeWinRate" | "length" | "equity" | "paired" | "anomaly";

export const FINDING_BUCKET_ORDER: FindingBucket[] = [
  "timeout",
  "floorCeiling",
  "typeWinRate",
  "length",
  "equity",
  "paired",
  "anomaly",
];

export const FINDING_BUCKET_LABELS: Record<FindingBucket, string> = {
  timeout: "Timeouts / stalls",
  floorCeiling: "0% or 100% win rate",
  typeWinRate: "Win rate vs type band",
  length: "Fight length",
  equity: "Within-pool spread",
  paired: "Card / talent / companion / boon delta",
  anomaly: "Anomaly spikes",
};

export interface BalanceFinding {
  severity: FindingSeverity;
  scope: FindingScope;
  id: string;
  title: string;
  tier: FindingsTier;
  metric: FindingMetric;
  bucket: FindingBucket;
  observed: number;
  band: string;
  worstScenario: string;
  causeHint?: string;
  recommendation: string;
  clusterSize?: number;
}

export interface BalanceFindingsReport {
  findings: BalanceFinding[];
  cap: number;
  omitted: number;
  totalBeforeCap: number;
  shownByBucket: Record<FindingBucket, number>;
  omittedByBucket: Record<FindingBucket, number>;
}
