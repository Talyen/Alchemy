import { cardById, type CharacterId } from "@/lib/game-data";
import { ANOMALY_METRICS, getAnomalyThreshold } from "./anomalies";
import { buildClassSimDeck } from "./class-deck";
import {
  balanceScenarioSeed,
  coreMatchupsForTier,
  coreScenarioSeeds,
  REPORT_ENEMY_TYPES,
  REPORT_TIERS,
  reportCharacterIds,
  reportTierForPreset,
  reportTierRecord,
  type ReportEnemyType,
} from "./report-catalog";
import type { AnomalyMetricRow, AnomalyReportRow, BalanceReportModel, ClassMatchupRow } from "./report-model";
import type { ReportRunOptions } from "./report-options";
import { combineRateCells, emptyRateCell, topPlayedCards, type RateCell } from "./report-rankings";
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

function cellFromBatch(batch: BalanceBatchResult): RateCell {
  return {
    wins: batch.wins,
    losses: batch.losses,
    timeouts: batch.timeouts,
    winRate: batch.winRate,
    timeoutRate: batch.timeoutRate,
    averageTurns: batch.averageTurns,
    averageEnemyAttacks: batch.averageEnemyAttacks,
    averageEnemyAbilityActivations: batch.averageEnemyAbilityActivations,
    averageEnemyAbilityUses: batch.averageEnemyAbilityUses,
    winsBeforeEnemyAttackRate: batch.winsBeforeEnemyAttackRate,
    averageHealthRemaining: batch.averageHealthRemaining,
    n: batch.iterations,
  };
}

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

interface CoreRow {
  characterId: CharacterId;
  enemyId: string;
  enemyType: ReportEnemyType;
  tier: TalentPreset;
  cell: RateCell;
  cardPlayCounts: Record<string, number>;
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
        const cardPlayCounts: Record<string, number> = {};
        for (const batch of batches) {
          for (const [cardId, count] of Object.entries(batch.cardPlayCounts)) {
            cardPlayCounts[cardId] = (cardPlayCounts[cardId] ?? 0) + count;
          }
        }
        rows.push({
          characterId,
          enemyId: matchup.enemyId,
          enemyType: matchup.enemyType,
          tier: tier.preset,
          cell: combineRateCells(batches.map(cellFromBatch)),
          cardPlayCounts,
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

function buildClassMatchups(rows: CoreRow[]): ClassMatchupRow[] {
  const groups = new Map<string, CoreRow[]>();
  for (const row of rows) {
    const key = `${row.characterId}|${row.enemyId}|${row.enemyType}`;
    const list = groups.get(key);
    if (list) list.push(row);
    else groups.set(key, [row]);
  }

  return [...groups.entries()]
    .map(([key, matching]) => {
      const [characterId, enemyId, enemyType] = key.split("|") as [CharacterId, string, ReportEnemyType];
      const lateCardCounts: Record<string, number> = {};
      for (const row of matching) {
        if (row.tier === "late") {
          for (const [id, count] of Object.entries(row.cardPlayCounts)) {
            lateCardCounts[id] = (lateCardCounts[id] ?? 0) + count;
          }
        }
      }
      return {
        characterId,
        enemyId,
        enemyType,
        rates: reportTierRecord((tier) =>
          combineRateCells(matching.filter((row) => row.tier === tier).map((row) => row.cell)),
        ),
        topCardsLate: topPlayedCards(lateCardCounts),
      };
    })
    .sort(
      (left, right) =>
        left.characterId.localeCompare(right.characterId) ||
        left.rates.late.winRate - right.rates.late.winRate ||
        left.enemyId.localeCompare(right.enemyId),
    );
}

export function equalWeightByType(byType: Readonly<Record<ReportEnemyType, RateCell>>): RateCell {
  const types = REPORT_ENEMY_TYPES.filter((type) => byType[type].n > 0);
  if (types.length === 0) return emptyRateCell();
  let totalN = 0;
  let winsTotal = 0;
  let lossesTotal = 0;
  let timeoutsTotal = 0;
  let winRateSum = 0;
  let timeoutRateSum = 0;
  let turnsSum = 0;
  let healthSum = 0;
  let attacksSum = 0;
  let abilityUsesSum = 0;
  let abilityActivationsSum = 0;
  let winsBeforeAttackSum = 0;

  for (const type of types) {
    const cell = byType[type];
    totalN += cell.n;
    winsTotal += cell.wins;
    lossesTotal += cell.losses;
    timeoutsTotal += cell.timeouts;
    winRateSum += cell.winRate;
    timeoutRateSum += cell.timeoutRate;
    turnsSum += cell.averageTurns;
    healthSum += cell.averageHealthRemaining;
    attacksSum += cell.averageEnemyAttacks;
    abilityUsesSum += cell.averageEnemyAbilityUses;
    abilityActivationsSum += cell.averageEnemyAbilityActivations;
    winsBeforeAttackSum += cell.winsBeforeEnemyAttackRate;
  }
  const count = types.length;
  return {
    wins: winsTotal,
    losses: lossesTotal,
    timeouts: timeoutsTotal,
    winRate: winRateSum / count,
    timeoutRate: timeoutRateSum / count,
    averageTurns: turnsSum / count,
    averageEnemyAttacks: attacksSum / count,
    averageEnemyAbilityUses: abilityUsesSum / count,
    averageEnemyAbilityActivations: abilityActivationsSum / count,
    winsBeforeEnemyAttackRate: winsBeforeAttackSum / count,
    averageHealthRemaining: healthSum / count,
    n: totalN,
  };
}

export function buildBalanceReport(options: ReportRunOptions): BalanceReportModel {
  const core = withPhaseTiming("core scenarios", () => runCoreScenarios(options));
  const { anomalies, metrics } = withPhaseTiming("anomalies", () => collectAnomalies(core));

  const byEnemy = new Map<string, CoreRow[]>();
  const byCharacter = new Map<CharacterId, CoreRow[]>();
  for (const row of core) {
    const enemyList = byEnemy.get(row.enemyId);
    if (enemyList) enemyList.push(row);
    else byEnemy.set(row.enemyId, [row]);

    const charList = byCharacter.get(row.characterId);
    if (charList) charList.push(row);
    else byCharacter.set(row.characterId, [row]);
  }

  const enemies = [...byEnemy.entries()].map(([id, matching]) => ({
    id,
    rates: reportTierRecord((tier) =>
      combineRateCells(matching.filter((row) => row.tier === tier).map((row) => row.cell)),
    ),
  }));

  const classes = reportCharacterIds().map((id) => {
    const matching = byCharacter.get(id) ?? [];
    const byType = (tier: TalentPreset): Record<ReportEnemyType, RateCell> =>
      Object.fromEntries(
        REPORT_ENEMY_TYPES.map((type) => [
          type,
          combineRateCells(
            matching.filter((row) => row.tier === tier && row.enemyType === type).map((row) => row.cell),
          ),
        ]),
      ) as Record<ReportEnemyType, RateCell>;
    const ratesByType = reportTierRecord(byType);
    return {
      id,
      rates: reportTierRecord((tier) => equalWeightByType(ratesByType[tier])),
      ratesByType,
    };
  });
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
    enemies: enemies.sort((a, b) => a.rates.late.winRate - b.rates.late.winRate),
    classes: classes.sort((a, b) => a.rates.late.winRate - b.rates.late.winRate),
    classMatchups: withPhaseTiming("class matchups", () => buildClassMatchups(core)),
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
    affixes: withPhaseTiming("affix sweep", () => runAffixSweep(options)),
    anomalies,
    anomalyMetrics: metrics,
  };
}
