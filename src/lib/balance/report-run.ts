import { cardById } from "@/lib/game-data";
import { ANOMALY_METRICS, getAnomalyThreshold } from "./anomalies";
import { buildClassSimDeck } from "./class-deck";
import {
  balanceScenarioSeed,
  coreMatchupsForTier,
  coreScenarioSeeds,
  REPORT_TIERS,
  reportCharacterIds,
  reportTierForPreset,
  reportTierRecord,
} from "./report-catalog";
import type { AnomalyMetricRow, AnomalyReportRow, BalanceReportModel, PairedTierRow } from "./report-model";
import { rateCellFromBatch } from "./rate-statistics";
import type { ReportRunOptions } from "./report-options";
import { combineRateCells } from "./report-rankings";
import { summarizeCoreRates, sumCardPlayCounts, type CoreRateRow } from "./core-report-summary";
import {
  buildBalanceBatchConfig,
  runAffixSweep,
  runCardSweepInClass,
  runCardSweepIsolated,
  runCompanionSweep,
  runGearSweep,
  runTalentSweep,
  runTrinketSweep,
} from "./report-sweeps";
import { simulateBatch } from "./simulator-batch";
import type { BalanceBatchResult, BattleSimulationResult, TalentPreset } from "./simulator-types";

export type { ReportRunOptions } from "./report-options";
export { equalWeightByType } from "./core-report-summary";

function shouldLogBalanceProgress(): boolean {
  return Boolean(process.env.ALCHEMY_BALANCE_VERBOSE) || Boolean(process.env.ALCHEMY_BALANCE_PROGRESS);
}

function withPhaseTiming<T>(label: string, fn: () => T): T {
  if (!shouldLogBalanceProgress()) return fn();
  const start = Date.now();
  process.stdout.write(`[balance] ${label}… `);
  const result = fn();
  process.stdout.write(`done ${Date.now() - start}ms\n`);
  return result;
}

export interface CoreRow extends CoreRateRow {
  results: Array<Pick<BattleSimulationResult, "characterId" | "enemyId" | "anomalies">>;
}

export function* coreScenarios(options: ReportRunOptions): Iterable<() => CoreRow> {
  for (const tier of REPORT_TIERS) {
    const matchups = coreMatchupsForTier(tier);
    for (const characterId of reportCharacterIds()) {
      const decks = Array.from({ length: options.deckSeeds }, (_, deckIndex) => {
        const deckSeed = balanceScenarioSeed("core-deck", tier.preset, characterId, deckIndex);
        return buildClassSimDeck(characterId, tier.preset, deckSeed);
      });
      for (const matchup of matchups) {
        yield () => {
          const batches: BalanceBatchResult[] = [];
          for (let deckIndex = 0; deckIndex < options.deckSeeds; deckIndex += 1) {
            const { fightSeed } = coreScenarioSeeds({
              tier: tier.preset,
              characterId,
              enemyId: matchup.enemyId,
              depth: matchup.depth,
              deckIndex,
            });
            const deck = decks[deckIndex];
            batches.push(
              simulateBatch(
                buildBalanceBatchConfig(options, {
                  characterId,
                  enemyId: matchup.enemyId,
                  depth: matchup.depth,
                  preset: tier.preset,
                  seed: fightSeed,
                  ...(deck ? { deck } : {}),
                }),
              ),
            );
          }
          return {
            characterId,
            enemyId: matchup.enemyId,
            enemyType: matchup.enemyType,
            tier: tier.preset,
            cell: combineRateCells(batches.map(rateCellFromBatch)),
            cardPlayCounts: sumCardPlayCounts(batches.map((batch) => batch.cardPlayCounts)),
            results: batches.flatMap((batch) =>
              batch.results.map(({ characterId: resultCharacterId, enemyId, anomalies }) => ({
                characterId: resultCharacterId,
                enemyId,
                anomalies,
              })),
            ),
          };
        };
      }
    }
  }
}

export function collectAnomalies(rows: readonly CoreRow[]): {
  anomalies: AnomalyReportRow[];
  metrics: AnomalyMetricRow[];
} {
  const byField: Record<string, { field: string; maxValue: number; battles: number; peakScenario: string }> = {};
  const perTier: Record<TalentPreset, Record<string, number>> = { early: {}, mid: {}, late: {} };
  for (const row of rows) {
    const threshold = getAnomalyThreshold(row.tier);
    const tierLabel = reportTierForPreset(row.tier).label;
    const tierMaxima = perTier[row.tier];
    for (const simulation of row.results) {
      const anomalies = simulation.anomalies;
      for (const { key, label } of ANOMALY_METRICS) {
        const value = anomalies[key];
        tierMaxima[key] = Math.max(tierMaxima[key] ?? 0, value);
        if (value <= threshold) continue;
        byField[key] ??= { field: label, maxValue: 0, battles: 0, peakScenario: "" };
        const entry = byField[key];
        entry.battles += 1;
        if (value <= entry.maxValue) continue;
        entry.maxValue = value;
        const cardId =
          key === "maxSingleHitDamageToEnemy"
            ? anomalies.maxSingleHitDamageToEnemyCardId
            : key === "maxSingleHitDamageToPlayer"
              ? anomalies.maxSingleHitDamageToPlayerCardId
              : "";
        const stat =
          key === "maxSingleHitDamageToEnemy"
            ? anomalies.maxSingleHitDamageToEnemyStat
            : key === "maxSingleHitDamageToPlayer"
              ? anomalies.maxSingleHitDamageToPlayerStat
              : "";
        const card = cardId ? (cardById[cardId]?.title ?? cardId) : "";
        entry.peakScenario = [`${simulation.characterId} vs ${simulation.enemyId} (${tierLabel})`, stat, card]
          .filter(Boolean)
          .join(" · ");
      }
    }
  }
  const metrics: AnomalyMetricRow[] = ANOMALY_METRICS.map(({ key, label }) => ({
    field: label,
    values: reportTierRecord((tier) => perTier[tier][key] ?? 0),
  })).sort((left, right) => right.values.late - left.values.late);
  return { anomalies: Object.values(byField).sort((a, b) => b.maxValue - a.maxValue), metrics };
}

export interface CompactCoreRow {
  row: CoreRow;
  metrics: AnomalyMetricRow[];
}

export function compactCoreRow(row: CoreRow): CompactCoreRow {
  const { metrics } = collectAnomalies([row]);
  const threshold = getAnomalyThreshold(row.tier);
  return {
    row: {
      ...row,
      results: row.results.filter((result) => ANOMALY_METRICS.some(({ key }) => result.anomalies[key] > threshold)),
    },
    metrics,
  };
}

export function mergeCoreMetrics(chunks: readonly CompactCoreRow[]): AnomalyMetricRow[] {
  const maxima = new Map<string, { field: string; values: Record<TalentPreset, number> }>(
    ANOMALY_METRICS.map(({ label }) => [label, { field: label, values: { early: 0, mid: 0, late: 0 } }]),
  );
  for (const chunk of chunks) {
    for (const metric of chunk.metrics) {
      const entry = maxima.get(metric.field);
      if (!entry) throw new Error(`Unknown anomaly metric: ${metric.field}`);
      for (const tier of ["early", "mid", "late"] as const)
        entry.values[tier] = Math.max(entry.values[tier], metric.values[tier]);
    }
  }
  return [...maxima.values()].sort((left, right) => right.values.late - left.values.late);
}

type CoreSummary = Pick<BalanceReportModel, "enemies" | "classes" | "classMatchups">;
type SweepSummary = Pick<
  BalanceReportModel,
  | "boons"
  | "cardsIsolatedSkeleton"
  | "cardsIsolatedElite"
  | "cardsInClass"
  | "talents"
  | "companions"
  | "gear"
  | "affixes"
>;

export function composeBalanceReport(
  options: ReportRunOptions,
  core: CoreSummary,
  sweeps: SweepSummary,
  anomalySummary: { anomalies: AnomalyReportRow[]; metrics: AnomalyMetricRow[] },
): BalanceReportModel {
  return {
    meta: {
      samplingMode: options.mode ?? "custom",
      policy: options.policy,
      loadoutMode: options.loadoutMode,
      iterations: options.iterations,
      pairedIterations: options.pairedIterations,
      cardDeckSamples: options.cardDeckSamples,
      deckSeeds: options.deckSeeds,
    },
    ...core,
    ...sweeps,
    anomalies: anomalySummary.anomalies,
    anomalyMetrics: anomalySummary.metrics,
  };
}

export function buildBalanceReport(options: ReportRunOptions): BalanceReportModel {
  const core = withPhaseTiming("core scenarios", () => Array.from(coreScenarios(options), (run) => run()));
  const { anomalies, metrics } = withPhaseTiming("anomalies", () => collectAnomalies(core));

  const summary = withPhaseTiming("core rate summary", () => summarizeCoreRates(core));
  const rankedSweep = (label: string, run: () => PairedTierRow[]) =>
    withPhaseTiming(label, () => run().sort((a, b) => a.deltas.late.delta - b.deltas.late.delta));
  const sweeps = {
    boons: rankedSweep("boon sweep", () => runTrinketSweep(options)),
    cardsIsolatedSkeleton: rankedSweep("card isolated (skeleton)", () => runCardSweepIsolated(options, "skeleton")),
    cardsIsolatedElite: rankedSweep("card isolated (elite)", () => runCardSweepIsolated(options, "mimic")),
    cardsInClass: rankedSweep("card in-class", () => runCardSweepInClass(options)),
    talents: rankedSweep("talent sweep", () => runTalentSweep(options)),
    companions: rankedSweep("companion sweep", () => runCompanionSweep(options)),
    gear: rankedSweep("gear sweep", () => runGearSweep(options)),
    affixes: rankedSweep("affix sweep", () => runAffixSweep(options)),
  };
  return composeBalanceReport(options, summary, sweeps, { anomalies, metrics });
}
