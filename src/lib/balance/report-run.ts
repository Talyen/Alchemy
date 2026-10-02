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
import type { AnomalyMetricRow, AnomalyReportRow, BalanceReportModel } from "./report-model";
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
import type { BalanceBatchResult, TalentPreset } from "./simulator-types";

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

interface CoreRow extends CoreRateRow {
  results: BalanceBatchResult["results"];
}

function runCoreScenarios(options: ReportRunOptions): CoreRow[] {
  const rows: CoreRow[] = [];
  for (const tier of REPORT_TIERS) {
    for (const characterId of reportCharacterIds()) {
      const decks = Array.from({ length: options.deckSeeds }, (_, deckIndex) => {
        const deckSeed = balanceScenarioSeed("core-deck", tier.preset, characterId, deckIndex);
        return buildClassSimDeck(characterId, tier.preset, deckSeed);
      });
      for (const matchup of coreMatchupsForTier(tier)) {
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
        rows.push({
          characterId,
          enemyId: matchup.enemyId,
          enemyType: matchup.enemyType,
          tier: tier.preset,
          cell: combineRateCells(batches.map(rateCellFromBatch)),
          cardPlayCounts: sumCardPlayCounts(batches.map((batch) => batch.cardPlayCounts)),
          results: batches.flatMap((batch) => batch.results),
        });
      }
    }
  }
  return rows;
}

function collectAnomalies(rows: CoreRow[]): { anomalies: AnomalyReportRow[]; metrics: AnomalyMetricRow[] } {
  const byField: Record<string, { field: string; maxValue: number; battles: number; peakScenario: string }> = {};
  const perTier: Record<TalentPreset, Record<string, number>> = { early: {}, mid: {}, late: {} };
  for (const row of rows) {
    const threshold = getAnomalyThreshold(row.tier);
    for (const simulation of row.results) {
      const anomalies = simulation.anomalies;
      for (const { key, label } of ANOMALY_METRICS) {
        const value = anomalies[key];
        if (typeof value !== "number") continue;
        perTier[row.tier][key] = Math.max(perTier[row.tier][key] ?? 0, value);
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
        entry.peakScenario = [
          `${simulation.characterId} vs ${simulation.enemyId} (${reportTierForPreset(row.tier).label})`,
          stat,
          card,
        ]
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

export function buildBalanceReport(options: ReportRunOptions): BalanceReportModel {
  const core = withPhaseTiming("core scenarios", () => runCoreScenarios(options));
  const { anomalies, metrics } = withPhaseTiming("anomalies", () => collectAnomalies(core));

  const summary = withPhaseTiming("core rate summary", () => summarizeCoreRates(core));
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
    ...summary,
    boons: withPhaseTiming("boon sweep", () =>
      runTrinketSweep(options).sort((a, b) => a.deltas.late.delta - b.deltas.late.delta),
    ),
    cardsIsolatedSkeleton: withPhaseTiming("card isolated (skeleton)", () =>
      runCardSweepIsolated(options, "skeleton").sort((a, b) => a.deltas.late.delta - b.deltas.late.delta),
    ),
    cardsIsolatedElite: withPhaseTiming("card isolated (elite)", () =>
      runCardSweepIsolated(options, "mimic").sort((a, b) => a.deltas.late.delta - b.deltas.late.delta),
    ),
    cardsInClass: withPhaseTiming("card in-class", () =>
      runCardSweepInClass(options).sort((a, b) => a.deltas.late.delta - b.deltas.late.delta),
    ),
    talents: withPhaseTiming("talent sweep", () =>
      runTalentSweep(options).sort((a, b) => a.deltas.late.delta - b.deltas.late.delta),
    ),
    companions: withPhaseTiming("companion sweep", () =>
      runCompanionSweep(options).sort((a, b) => a.deltas.late.delta - b.deltas.late.delta),
    ),
    gear: withPhaseTiming("gear sweep", () =>
      runGearSweep(options).sort((a, b) => a.deltas.late.delta - b.deltas.late.delta),
    ),
    affixes: withPhaseTiming("affix sweep", () =>
      runAffixSweep(options).sort((a, b) => a.deltas.late.delta - b.deltas.late.delta),
    ),
    anomalies,
    anomalyMetrics: metrics,
  };
}
