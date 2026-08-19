// Structured balance-report payload shared by HTML and JSON exporters.
import type { CharacterId } from "@/lib/game-data";
import type { BalanceLoadoutMode } from "./loadout-preset";
import type { PairedDelta, RateCell } from "./report-rankings";
import type { BalancePlayPolicy } from "./simulator-types";

export interface TierRateRow {
  id: string;
  early: RateCell;
  mid: RateCell;
  late: RateCell;
}

interface ClassTypeSplitRow {
  id: CharacterId;
  early: RateCell;
  mid: RateCell;
  late: RateCell;
  earlyByType: Record<string, RateCell>;
  midByType: Record<string, RateCell>;
  lateByType: Record<string, RateCell>;
}

export interface ClassMatchupRow {
  characterId: CharacterId;
  enemyId: string;
  enemyType: string;
  early: RateCell;
  mid: RateCell;
  late: RateCell;
  topCardsLate: Array<{ cardId: string; count: number }>;
}

export interface AnomalyReportRow {
  field: string;
  maxValue: number;
  battles: number;
  peakScenario: string;
}

export interface AnomalyMetricRow {
  field: string;
  early: number;
  mid: number;
  late: number;
  thresholds: number[];
}

export interface PairedTierRow {
  id: string;
  early: PairedDelta;
  mid: PairedDelta;
  late: PairedDelta;
}

export interface BalanceReportModel {
  meta: {
    policy: BalancePlayPolicy;
    loadoutMode: BalanceLoadoutMode;
    iterations: number;
    trinketIterations: number;
    cardIterations: number;
    deckSeeds: number;
  };
  enemies: TierRateRow[];
  classes: ClassTypeSplitRow[];
  classMatchups: ClassMatchupRow[];
  boons: PairedTierRow[];
  cardsIsolatedSkeleton: PairedTierRow[];
  cardsIsolatedElite: PairedTierRow[];
  cardsInClass: PairedTierRow[];
  talents: PairedTierRow[];
  companions: PairedTierRow[];
  anomalies: AnomalyReportRow[];
  anomalyMetrics: AnomalyMetricRow[];
}
