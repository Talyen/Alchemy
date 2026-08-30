import { cardById, characters, enemiesByType, type CharacterId } from "@/lib/game-data";
import { ANOMALY_METRICS, ANOMALY_THRESHOLD_BY_PRESET, getAnomalyThreshold } from "./anomalies";
import { buildClassSimDeck, CLASS_SIM_AFFINITY_EXTRAS, WILDCARD_SIM_DECK_SIZE } from "./class-deck";
import { TIER_GOLD, TYPICAL_VITALITY_COMBATS } from "./loadout-preset";
import { REPORT_TIERS } from "./report-catalog";
import type { AnomalyMetricRow, AnomalyReportRow, BalanceReportModel, ClassMatchupRow } from "./report-model";
import type { ReportRunOptions } from "./report-options";
import { combineRateCells, emptyRateCell, topPlayedCards, type RateCell } from "./report-rankings";
import {
  buildBalanceBatchConfig,
  runCardSweepInClass,
  runCardSweepIsolated,
  runCompanionSweep,
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

function characterIds(): CharacterId[] {
  return Object.keys(characters) as CharacterId[];
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
  enemyType: string;
  tier: "Early" | "Mid" | "Late";
  cell: RateCell;
  cardPlayCounts: Record<string, number>;
  results: BalanceBatchResult["results"];
}

function runCoreScenarios(options: ReportRunOptions): CoreRow[] {
  const rows: CoreRow[] = [];
  let seed = 1000;
  for (const tier of REPORT_TIERS) {
    const offset = tier.depthOffset;
    for (const characterId of characterIds()) {
      const matchups: Array<{ enemyId: string; enemyType: string; depth: number }> = [];
      for (const enemy of enemiesByType.normal) {
        for (const depth of [offset, offset + 3, offset + 6]) {
          matchups.push({ enemyId: enemy.id, enemyType: "normal", depth });
        }
      }
      for (const enemy of enemiesByType.elite) {
        for (const depth of [offset + 2, offset + 5, offset + 7]) {
          matchups.push({ enemyId: enemy.id, enemyType: "elite", depth });
        }
      }
      for (const enemy of enemiesByType.boss) {
        matchups.push({ enemyId: enemy.id, enemyType: "boss", depth: offset + 7 });
      }

      for (const matchup of matchups) {
        const batches: BalanceBatchResult[] = [];
        for (let deckIndex = 0; deckIndex < options.deckSeeds; deckIndex += 1) {
          const scenarioSeed = seed + deckIndex;
          batches.push(
            simulateBatch(
              buildBalanceBatchConfig(options, {
                characterId,
                enemyId: matchup.enemyId,
                depth: matchup.depth,
                preset: tier.preset,
                seed: scenarioSeed,
                deck: buildClassSimDeck(characterId, tier.preset, scenarioSeed),
              }),
            ),
          );
        }
        seed += 1000;
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
          tier: tier.label,
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
  const byField: Record<string, AnomalyReportRow> = {};
  const perTier: Record<string, Record<string, number>> = { Early: {}, Mid: {}, Late: {} };
  for (const row of rows) {
    const threshold = getAnomalyThreshold(row.tier.toLowerCase() as "early" | "mid" | "late");
    for (const simulation of row.results) {
      const anomalies = simulation.anomalies;
      for (const { key, label } of ANOMALY_METRICS) {
        const value = anomalies[key];
        if (typeof value !== "number") continue;
        perTier[row.tier]![key] = Math.max(perTier[row.tier]![key] ?? 0, value);
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
        entry.peakScenario = [`${simulation.characterId} vs ${simulation.enemyId} (${row.tier})`, stat, card]
          .filter(Boolean)
          .join(" · ");
      }
    }
  }
  const thresholds = REPORT_TIERS.map((tier) => ANOMALY_THRESHOLD_BY_PRESET[tier.preset]);
  const metrics: AnomalyMetricRow[] = ANOMALY_METRICS.map(({ key, label }) => ({
    field: label,
    early: perTier.Early?.[key] ?? 0,
    mid: perTier.Mid?.[key] ?? 0,
    late: perTier.Late?.[key] ?? 0,
    thresholds,
  })).sort((left, right) => right.late - left.late);
  return { anomalies: Object.values(byField).sort((a, b) => b.maxValue - a.maxValue), metrics };
}

function buildClassMatchups(rows: CoreRow[]): ClassMatchupRow[] {
  const keys = new Set(rows.map((row) => `${row.characterId}|${row.enemyId}|${row.enemyType}`));
  return [...keys].map((key) => {
    const [characterId, enemyId, enemyType] = key.split("|") as [CharacterId, string, string];
    const matching = rows.filter(
      (row) => row.characterId === characterId && row.enemyId === enemyId && row.enemyType === enemyType,
    );
    const late = matching.find((row) => row.tier === "Late");
    return {
      characterId,
      enemyId,
      enemyType,
      early: matching.find((row) => row.tier === "Early")?.cell ?? emptyRateCell(),
      mid: matching.find((row) => row.tier === "Mid")?.cell ?? emptyRateCell(),
      late: late?.cell ?? emptyRateCell(),
      topCardsLate: late ? topPlayedCards(late.cardPlayCounts) : [],
    };
  });
}

function equalWeightByType(byType: Record<string, RateCell>): RateCell {
  const types = ["normal", "elite", "boss"].filter((type) => byType[type] && byType[type].n > 0);
  if (types.length === 0) return emptyRateCell();
  return combineRateCells(types.map((type) => ({ ...byType[type]!, n: 1 })));
}

export function buildBalanceReport(options: ReportRunOptions): BalanceReportModel {
  const core = withPhaseTiming("core scenarios", () => runCoreScenarios(options));
  const { anomalies, metrics } = withPhaseTiming("anomalies", () => collectAnomalies(core));
  const enemies = [...new Set(core.map((row) => row.enemyId))].map((id) => {
    const matching = core.filter((row) => row.enemyId === id);
    return {
      id,
      early: combineRateCells(matching.filter((row) => row.tier === "Early").map((row) => row.cell)),
      mid: combineRateCells(matching.filter((row) => row.tier === "Mid").map((row) => row.cell)),
      late: combineRateCells(matching.filter((row) => row.tier === "Late").map((row) => row.cell)),
    };
  });
  const classes = characterIds().map((id) => {
    const matching = core.filter((row) => row.characterId === id);
    const byType = (tier: string): Record<string, RateCell> =>
      Object.fromEntries(
        ["normal", "elite", "boss"].map((type) => [
          type,
          combineRateCells(
            matching.filter((row) => row.tier === tier && row.enemyType === type).map((row) => row.cell),
          ),
        ]),
      );
    const earlyByType = byType("Early");
    const midByType = byType("Mid");
    const lateByType = byType("Late");
    return {
      id,
      early: equalWeightByType(earlyByType),
      mid: equalWeightByType(midByType),
      late: equalWeightByType(lateByType),
      earlyByType,
      midByType,
      lateByType,
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
    enemies: enemies.sort((a, b) => a.late.winRate - b.late.winRate),
    classes: classes.sort((a, b) => a.late.winRate - b.late.winRate),
    classMatchups: withPhaseTiming("class matchups", () => buildClassMatchups(core)),
    boons: withPhaseTiming("boon sweep", () => runTrinketSweep(options).sort((a, b) => a.late.delta - b.late.delta)),
    cardsIsolatedSkeleton: withPhaseTiming("card isolated (skeleton)", () =>
      runCardSweepIsolated(options, "skeleton").sort((a, b) => a.late.delta - b.late.delta),
    ),
    cardsIsolatedElite: withPhaseTiming("card isolated (elite)", () =>
      runCardSweepIsolated(options, "mimic").sort((a, b) => a.late.delta - b.late.delta),
    ),
    cardsInClass: withPhaseTiming("card in-class", () =>
      runCardSweepInClass(options).sort((a, b) => a.late.delta - b.late.delta),
    ),
    talents: withPhaseTiming("talent sweep", () => runTalentSweep(options).sort((a, b) => a.late.delta - b.late.delta)),
    companions: withPhaseTiming("companion sweep", () =>
      runCompanionSweep(options).sort((a, b) => a.late.delta - b.late.delta),
    ),
    anomalies,
    anomalyMetrics: metrics,
  };
}

export function reportMethodologyLines(options: ReportRunOptions): string[] {
  return [
    `Core scenarios: all characters × normal/elite/boss × tier depths × ${options.deckSeeds} class-deck seeds.`,
    `Deck: starting deck + affinity extras (Early +${CLASS_SIM_AFFINITY_EXTRAS.early}, Mid +${CLASS_SIM_AFFINITY_EXTRAS.mid}, Late +${CLASS_SIM_AFFINITY_EXTRAS.late}). Wildcard random ${WILDCARD_SIM_DECK_SIZE.early}/${WILDCARD_SIM_DECK_SIZE.mid}/${WILDCARD_SIM_DECK_SIZE.late}. Alchemist +2 mixed potions.`,
    `Talents (combat-eligible only, tree order): Early none; Mid ${MID_AFFINITY_TALENT_COUNT} affinity + ${MID_OTHER_TALENT_COUNT} other; Late up to ${LATE_AFFINITY_TALENT_CAP} affinity + ${LATE_OTHER_TALENT_COUNT} other. Shop/run-only talents are excluded.`,
    `Gold: Early ${TIER_GOLD.early} / Mid ${TIER_GOLD.mid} / Late ${TIER_GOLD.late}, plus startGold from combat talents. Explicit config.gold overrides.`,
    `Loadout mode=${options.loadoutMode}. typical adds +1 max HP per affinity combat talent (Wildcard uses a 3-keyword equivalent), Vitality max HP (Mid ${TYPICAL_VITALITY_COMBATS.mid} / Late ${TYPICAL_VITALITY_COMBATS.late} estimated combats), Mid 1★ / Late 2★ homestead via computeHomesteadEffects, seeded affinity gear (Mid weapon+body, Late full set), and Mid/Late core trinkets (Grove's Favor / Tattered Pages). bare keeps talent-point HP and tier gold but omits Vitality, homestead, gear, and core trinkets. Gear uses a salted RNG stream from the fight seed so paired isolation sweeps stay matched. Boon/card isolation sweeps force trinketIds to the isolated set.`,
    `Difficulty: Early none; Mid Adventurer (HP/dmg ×1.3); Late Legend (HP ×2.8, dmg ×1.6). Room scaling uses scenario depth.`,
    `Class rankings weight Normal/Elite/Boss equally. Isolation sweeps pair baseline and treatment by deck, matchup, and seed. Delta SE uses the sample variance of per-seed win differences; deltas below 2 SE are marked noisy.`,
    `Play policy=${options.policy} is a skill floor: dump-hand, random wishes, no holds. greedy-damage is face damage only; greedy-effective-damage also scores DoT/status/block.`,
    `Fight pacing ${options.appliesFightPacing === false ? "off" : "on"} (hidden comeback × clock scaler; ALCHEMY_BALANCE_PACING=off measures raw kit).`,
    `Not simulated: map/shop/rewards, HP carryover, Labyrinth/Wildwood traits, multi-trinket synergies beyond the typical core pair.`,
    `Iron Bear Iron Hide picks one of armor, forge, or burn every other enemy turn.`,
  ];
}
