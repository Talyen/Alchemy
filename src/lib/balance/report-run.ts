import { cardById, type CharacterId } from "@/lib/game-data";
import { ANOMALY_METRICS, getAnomalyThreshold } from "./anomalies";
import { buildClassSimDeck, CLASS_SIM_AFFINITY_EXTRAS, WILDCARD_SIM_DECK_SIZE } from "./class-deck";
import { TIER_GOLD } from "./loadout-preset";
import {
  coreScenarioSeeds,
  coreMatchupsForTier,
  reportCharacterIds,
  REPORT_ENEMY_TYPES,
  reportTierForPreset,
  reportTierRecord,
  REPORT_TIERS,
  type ReportEnemyType,
} from "./report-catalog";
import type { AnomalyMetricRow, AnomalyReportRow, BalanceReportModel, ClassMatchupRow } from "./report-model";
import type { ReportRunOptions } from "./report-options";
import { combineRateCells, emptyRateCell, topPlayedCards, type RateCell } from "./report-rankings";
import {
  buildBalanceBatchConfig,
  runCardSweepInClass,
  runCardSweepIsolated,
  runCompanionSweep,
  runGearSweep,
  runTalentSweep,
  runTrinketSweep,
} from "./report-sweeps";
import { simulateBatch } from "./simulator-batch";
import type { BalanceBatchResult } from "./simulator-types";
import {
  LATE_AFFINITY_TALENT_CAP,
  LATE_OTHER_TALENT_COUNT,
  MID_AFFINITY_TALENT_COUNT,
  MID_OTHER_TALENT_COUNT,
} from "./talent-preset";
import type { TalentPreset } from "./types";

export type { ReportRunOptions } from "./report-options";

function cellFromBatch(batch: BalanceBatchResult): RateCell {
  return {
    winRate: batch.winRate,
    timeoutRate: batch.timeoutRate,
    averageTurns: batch.averageTurns,
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
      for (const matchup of coreMatchupsForTier(tier)) {
        const batches: BalanceBatchResult[] = [];
        for (let deckIndex = 0; deckIndex < options.deckSeeds; deckIndex += 1) {
          const { deckSeed, fightSeed } = coreScenarioSeeds({
            tier: tier.preset,
            characterId,
            enemyId: matchup.enemyId,
            depth: matchup.depth,
            deckIndex,
          });
          batches.push(
            simulateBatch(
              buildBalanceBatchConfig(options, {
                characterId,
                enemyId: matchup.enemyId,
                depth: matchup.depth,
                preset: tier.preset,
                seed: fightSeed,
                deck: buildClassSimDeck(characterId, tier.preset, deckSeed),
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
  const keys = new Set(rows.map((row) => `${row.characterId}|${row.enemyId}|${row.enemyType}`));
  return [...keys]
    .map((key) => {
      const [characterId, enemyId, enemyType] = key.split("|") as [CharacterId, string, ReportEnemyType];
      const matching = rows.filter(
        (row) => row.characterId === characterId && row.enemyId === enemyId && row.enemyType === enemyType,
      );
      const late = matching.find((row) => row.tier === "late");
      return {
        characterId,
        enemyId,
        enemyType,
        rates: reportTierRecord((tier) => matching.find((row) => row.tier === tier)?.cell ?? emptyRateCell()),
        topCardsLate: late ? topPlayedCards(late.cardPlayCounts) : [],
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
  const equalWeighted = combineRateCells(types.map((type) => ({ ...byType[type], n: 1 })));
  return { ...equalWeighted, n: types.reduce((total, type) => total + byType[type].n, 0) };
}

export function buildBalanceReport(options: ReportRunOptions): BalanceReportModel {
  const core = withPhaseTiming("core scenarios", () => runCoreScenarios(options));
  const { anomalies, metrics } = withPhaseTiming("anomalies", () => collectAnomalies(core));
  const enemies = [...new Set(core.map((row) => row.enemyId))].map((id) => {
    const matching = core.filter((row) => row.enemyId === id);
    return {
      id,
      rates: reportTierRecord((tier) =>
        combineRateCells(matching.filter((row) => row.tier === tier).map((row) => row.cell)),
      ),
    };
  });
  const classes = reportCharacterIds().map((id) => {
    const matching = core.filter((row) => row.characterId === id);
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
      policy: options.policy,
      loadoutMode: options.loadoutMode,
      iterations: options.iterations,
      trinketIterations: options.trinketIterations,
      cardIterations: options.cardIterations,
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
    anomalies,
    anomalyMetrics: metrics,
  };
}

export function reportMethodologyLines(options: ReportRunOptions): string[] {
  return [
    `Core scenarios: all characters × normal/elite/boss × tier depths × ${options.deckSeeds} semantic class-deck seeds. Each tier/class deck sample is reused across enemies; fight seeds remain matchup-specific.`,
    `Deck: starting deck + affinity extras (Early +${CLASS_SIM_AFFINITY_EXTRAS.early}, Mid +${CLASS_SIM_AFFINITY_EXTRAS.mid}, Late +${CLASS_SIM_AFFINITY_EXTRAS.late}). Wildcard random ${WILDCARD_SIM_DECK_SIZE.early}/${WILDCARD_SIM_DECK_SIZE.mid}/${WILDCARD_SIM_DECK_SIZE.late}. Alchemist +2 mixed potions.`,
    `Talents (combat-eligible only, tree order): Early none; Mid ${MID_AFFINITY_TALENT_COUNT} affinity + ${MID_OTHER_TALENT_COUNT} other; Late up to ${LATE_AFFINITY_TALENT_CAP} affinity + ${LATE_OTHER_TALENT_COUNT} other. Shop/run-only talents are excluded.`,
    `Gold: Early ${TIER_GOLD.early} / Mid ${TIER_GOLD.mid} / Late ${TIER_GOLD.late}, plus startGold from combat talents. Explicit config.gold overrides.`,
    `Loadout mode=${options.loadoutMode}. typical adds +1 max HP per combat talent (Wildcard uses the full budget equivalent), Mid 1★ / Late 2★ homestead via computeHomesteadEffects, seeded affinity gear (Mid weapon+body, Late full set), and Mid/Late core trinkets (Grove's Favor / Tattered Pages). bare keeps talent-point HP and tier gold but omits homestead, gear, and core trinkets. Gear uses a salted RNG stream from the fight seed so paired isolation sweeps stay matched. Boon/card isolation sweeps force trinketIds to the isolated set.`,
    `Difficulty: Normal (Novice, canonical modifiers). Room scaling uses scenario depth.`,
    `Class rankings weight Normal/Elite/Boss equally while retaining the underlying battle count. Isolation sweeps pair baseline and treatment by deck, matchup, and semantic seed. Delta SE uses the sample variance of per-seed win differences; deltas below 2 SE are marked noisy.`,
    `Play policy=${options.policy} is a skill floor: dump-hand, random wishes, no holds. greedy-damage is face damage only; greedy-effective-damage also scores DoT/status/block.`,
    `Fight pacing ${options.appliesFightPacing === false ? "off" : "on"} (hidden comeback × clock scaler; ALCHEMY_BALANCE_PACING=off measures raw kit).`,
    `Not simulated: map/shop/rewards, HP carryover, Labyrinth/Wildwood traits, multi-trinket synergies beyond the typical core pair.`,
    `Iron Bear Iron Hide picks one of armor, forge, or burn every other enemy turn.`,
  ];
}
