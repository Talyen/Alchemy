import type { FindingsTier } from "./findings-bands";

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
