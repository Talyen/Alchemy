import type { CharacterId } from "@/lib/game-data";
import type { BalanceLoadoutMode } from "./loadout-preset";
import type { ReportEnemyType, ReportTierRecord } from "./report-catalog";
import type { PairedDelta, RateCell } from "./report-rankings";
import type { BalancePlayPolicy } from "./simulator-types";

export interface TierRateRow {
  readonly id: string;
  readonly rates: ReportTierRecord<RateCell>;
}

interface ClassTypeSplitRow {
  readonly id: CharacterId;
  readonly rates: ReportTierRecord<RateCell>;
  readonly ratesByType: ReportTierRecord<Readonly<Record<ReportEnemyType, RateCell>>>;
}

export interface ClassMatchupRow {
  readonly characterId: CharacterId;
  readonly enemyId: string;
  readonly enemyType: ReportEnemyType;
  readonly rates: ReportTierRecord<RateCell>;
  readonly topCardsLate: ReadonlyArray<{ cardId: string; count: number }>;
}

export interface AnomalyReportRow {
  readonly field: string;
  readonly maxValue: number;
  readonly battles: number;
  readonly peakScenario: string;
}

export interface AnomalyMetricRow {
  readonly field: string;
  readonly values: ReportTierRecord<number>;
}

export interface PairedTierRow {
  readonly id: string;
  readonly deltas: ReportTierRecord<PairedDelta>;
}

export interface BalanceReportModel {
  readonly meta: {
    readonly policy: BalancePlayPolicy;
    readonly loadoutMode: BalanceLoadoutMode;
    readonly iterations: number;
    readonly trinketIterations: number;
    readonly cardIterations: number;
    readonly deckSeeds: number;
  };
  readonly enemies: readonly TierRateRow[];
  readonly classes: readonly ClassTypeSplitRow[];
  readonly classMatchups: readonly ClassMatchupRow[];
  readonly boons: readonly PairedTierRow[];
  readonly cardsIsolatedSkeleton: readonly PairedTierRow[];
  readonly cardsIsolatedElite: readonly PairedTierRow[];
  readonly cardsInClass: readonly PairedTierRow[];
  readonly talents: readonly PairedTierRow[];
  readonly companions: readonly PairedTierRow[];
  readonly gear: readonly PairedTierRow[];
  readonly anomalies: readonly AnomalyReportRow[];
  readonly anomalyMetrics: readonly AnomalyMetricRow[];
}
