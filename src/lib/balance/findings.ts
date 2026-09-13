import { selectBalanceFindings } from "./findings-selection";
import type { BalanceFinding, BalanceFindingsReport, FindingScope } from "./findings-types";
export { FINDING_BUCKET_LABELS, FINDING_BUCKET_ORDER } from "./findings-types";
export type { BalanceFinding, BalanceFindingsReport, FindingBucket, FindingMetric } from "./findings-types";

import { enemyById, isEnemyId } from "@/lib/game-data";
import { ANOMALY_THRESHOLD_BY_PRESET } from "./anomalies";
import {
  EQUITY_SPREAD,
  FINDINGS_CAP,
  formatLengthBand,
  formatWinRateBand,
  isLengthOutsideBand,
  isWinRateFloorOrCeiling,
  isWinRateOutsideTypeBand,
  LENGTH_BAND_BY_TYPE,
  MATCHUP_TURN_SPREAD_THRESHOLD,
  MATERIAL_TIMEOUT_RATE,
  PAIRED_DELTA_FROM_MEDIAN,
  PAIRED_TURN_DELTA_THRESHOLD,
  WIN_RATE_BAND_BY_TYPE,
  type EnemyTypeBand,
  type FindingsTier,
} from "./findings-bands";
import { REPORT_ENEMY_TYPES, REPORT_TIERS, titleFor } from "./report-catalog";
import type { BalanceReportModel, ClassMatchupRow, PairedTierRow, TierRateRow } from "./report-model";
import type { ReportRunOptions } from "./report-options";
import type { RateCell } from "./report-rankings";
import { isDeltaNoisy } from "./report-rankings";

const ENEMY_CAUSE_HINTS: Record<string, string> = {
  "iron-bear": "Iron Hide grants 1 Armor every other enemy turn.",
  frostwarden: "Glacial Surge: half Freeze, 30% more Burn, +1 Freeze damage every other turn up to +2.",
  "forge-golem": "Rusting Carapace grants Forge every other turn; starts with Block.",
  "blight-treant": "Regeneration plus Burn vulnerability.",
  "fire-elemental": "Cinder Skin deals Burn when attacked.",
  "living-armor": "Starts combat with Armor; 25% less Bleed.",
  slime: "Amorphous: 10% less Physical and Poison.",
  necromancer: "Fangs, Bloodthorn, and Rend; double Holy damage received.",
};

const REVIEW_SUFFIX = " Discuss before applying a change.";

function enemyTypeOf(id: string): EnemyTypeBand | undefined {
  if (!isEnemyId(id)) return undefined;
  const entry = enemyById[id];
  if (entry.enemyType === "normal" || entry.enemyType === "elite" || entry.enemyType === "boss") {
    return entry.enemyType;
  }
  return undefined;
}

function titleEnemy(id: string): string {
  return titleFor("enemy", id);
}

function titleClass(id: string): string {
  return titleFor("character", id);
}

function titleCard(id: string): string {
  return titleFor("card", id);
}

function titleBoon(id: string): string {
  return titleFor("boon", id);
}

function titleCompanion(id: string): string {
  return titleFor("companion", id);
}

function titleTalent(id: string): string {
  return titleFor("talent", id);
}

function titleGear(id: string): string {
  return titleFor("gear", id);
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const high = sorted[mid] ?? 0;
  if (sorted.length % 2 === 1) return high;
  const low = sorted[mid - 1] ?? high;
  return (low + high) / 2;
}

function collectBalanceFindings(model: BalanceReportModel): BalanceFinding[] {
  const candidates: BalanceFinding[] = [];
  function add(finding: BalanceFinding): void {
    candidates.push(finding);
  }

  for (const enemy of model.enemies) {
    const enemyType = enemyTypeOf(enemy.id);
    for (const { preset: tier } of REPORT_TIERS) {
      collectRateFindings({
        add,
        scope: "enemy",
        id: enemy.id,
        title: titleEnemy(enemy.id),
        tier,
        cell: enemy.rates[tier],
        enemyType,
        worstScenario: `${titleEnemy(enemy.id)} (${tier})`,
        ...(ENEMY_CAUSE_HINTS[enemy.id] ? { causeHint: ENEMY_CAUSE_HINTS[enemy.id] } : {}),
      });
    }
  }

  collectEnemyTypeEquity(model.enemies, add);

  for (const row of model.classes) {
    for (const { preset: tier } of REPORT_TIERS) {
      collectRateFindings({
        add,
        scope: "class",
        id: row.id,
        title: titleClass(row.id),
        tier,
        cell: row.rates[tier],
        enemyType: undefined,
        worstScenario: `${titleClass(row.id)} overall (${tier})`,
        ...(row.id === "wizard" || row.id === "warlock"
          ? { causeHint: "Burn (and Bleed for Warlock) can spike stacks quickly." }
          : {}),
      });
    }

    for (const { preset: tier } of REPORT_TIERS) {
      for (const enemyType of REPORT_ENEMY_TYPES) {
        const cell = row.ratesByType[tier][enemyType];
        if (cell.n <= 0) continue;
        collectRateFindings({
          add,
          scope: "class",
          id: `${row.id}:${enemyType}`,
          title: `${titleClass(row.id)} vs ${enemyType}`,
          tier,
          cell,
          enemyType,
          worstScenario: `${titleClass(row.id)} vs ${enemyType} (${tier})`,
        });
      }
    }
  }

  collectClassEquity(model.classes, add);
  collectMatchupFindings(model, add);
  collectPairedFindings(model.boons, "boon", titleBoon, add);
  collectPairedFindings(model.cardsIsolatedSkeleton, "card", titleCard, add, "isolated vs Skeleton");
  collectPairedFindings(model.cardsIsolatedElite, "card", titleCard, add, "isolated vs Mimic");
  collectPairedFindings(model.cardsInClass, "card", titleCard, add, "in-class");
  collectPairedFindings(model.talents, "talent", titleTalent, add);
  collectPairedFindings(model.companions, "companion", titleCompanion, add);
  collectPairedFindings(model.gear, "gear", titleGear, add);
  collectPairedFindings(model.affixes, "affix", (id) => titleFor("affix", id), add);
  collectAnomalies(model, add);

  return candidates;
}

function collectRateFindings(options: {
  add: (finding: BalanceFinding) => void;
  scope: FindingScope;
  id: string;
  title: string;
  tier: FindingsTier;
  cell: RateCell;
  enemyType: EnemyTypeBand | undefined;
  worstScenario: string;
  causeHint?: string;
}): void {
  const { add, scope, id, title, tier, cell, enemyType, worstScenario, causeHint } = options;
  if (cell.n <= 0) return;

  if (cell.timeoutRate >= MATERIAL_TIMEOUT_RATE) {
    add({
      severity: "critical",
      scope,
      id,
      title,
      tier,
      metric: "timeoutRate",
      bucket: "timeout",
      observed: cell.timeoutRate,
      band: `< ${(MATERIAL_TIMEOUT_RATE * 100).toFixed(0)}% timeouts`,
      worstScenario,
      ...(causeHint ? { causeHint } : {}),
      recommendation: `Fights hit the 30-turn cap (stall).${REVIEW_SUFFIX}`,
    });
  }

  if (isWinRateFloorOrCeiling(cell.winRate)) {
    add({
      severity: "critical",
      scope,
      id,
      title,
      tier,
      metric: "winRate",
      bucket: "floorCeiling",
      observed: cell.winRate,
      band: "never 0% or 100%",
      worstScenario,
      ...(causeHint ? { causeHint } : {}),
      recommendation: `Win rate is a floor or ceiling.${REVIEW_SUFFIX}`,
    });
  } else if (enemyType === "boss" && cell.winRate < WIN_RATE_BAND_BY_TYPE.boss.min) {
    add({
      severity: "critical",
      scope,
      id,
      title,
      tier,
      metric: "winRate",
      bucket: "typeWinRate",
      observed: cell.winRate,
      band: formatWinRateBand("boss"),
      worstScenario,
      ...(causeHint ? { causeHint } : {}),
      recommendation: `Boss win rate is below 70%.${REVIEW_SUFFIX}`,
    });
  } else if (enemyType && isWinRateOutsideTypeBand(cell.winRate, enemyType)) {
    const tooLow = cell.winRate < WIN_RATE_BAND_BY_TYPE[enemyType].min;
    add({
      severity: "serious",
      scope,
      id,
      title,
      tier,
      metric: "winRate",
      bucket: "typeWinRate",
      observed: cell.winRate,
      band: formatWinRateBand(enemyType),
      worstScenario,
      ...(causeHint ? { causeHint } : {}),
      recommendation: tooLow
        ? `Win rate is below the ${enemyType} band.${REVIEW_SUFFIX}`
        : `Win rate is above the ${enemyType} band.${REVIEW_SUFFIX}`,
    });
  }

  if (enemyType && isLengthOutsideBand(cell.averageTurns, enemyType)) {
    const tooShort = cell.averageTurns < LENGTH_BAND_BY_TYPE[enemyType].min;
    add({
      severity: "serious",
      scope,
      id,
      title,
      tier,
      metric: "averageTurns",
      bucket: "length",
      observed: cell.averageTurns,
      band: formatLengthBand(enemyType),
      worstScenario,
      ...(causeHint ? { causeHint } : {}),
      recommendation: tooShort
        ? `Fight is shorter than the ${enemyType} length band.${REVIEW_SUFFIX}`
        : `Fight is longer than the ${enemyType} length band.${REVIEW_SUFFIX}`,
    });
  }
}

function collectEnemyTypeEquity(enemies: readonly TierRateRow[], add: (finding: BalanceFinding) => void): void {
  const byType: Record<EnemyTypeBand, TierRateRow[]> = { normal: [], elite: [], boss: [] };
  for (const enemy of enemies) {
    const enemyType = enemyTypeOf(enemy.id);
    if (!enemyType) continue;
    byType[enemyType].push(enemy);
  }
  for (const { preset: tier } of REPORT_TIERS) {
    for (const enemyType of REPORT_ENEMY_TYPES) {
      const rows = byType[enemyType];
      const rates = rows.map((row) => row.rates[tier].winRate).filter((_, i) => (rows[i]?.rates[tier].n ?? 0) > 0);
      if (rates.length < 2) continue;
      const med = median(rates);
      for (const row of rows) {
        if (row.rates[tier].n <= 0) continue;
        const spread = Math.abs(row.rates[tier].winRate - med);
        if (spread < EQUITY_SPREAD) continue;
        add({
          severity: "serious",
          scope: "enemy",
          id: row.id,
          title: titleEnemy(row.id),
          tier,
          metric: "winRate",
          bucket: "equity",
          observed: row.rates[tier].winRate,
          band: `within ${EQUITY_SPREAD * 100}% of ${enemyType} median (${(med * 100).toFixed(1)}%)`,
          worstScenario: `${titleEnemy(row.id)} (${tier})`,
          ...(ENEMY_CAUSE_HINTS[row.id] ? { causeHint: ENEMY_CAUSE_HINTS[row.id] } : {}),
          recommendation: `This ${enemyType} is 15pp+ from the type median (same power budget).${REVIEW_SUFFIX}`,
        });
      }
    }
  }
}

function collectClassEquity(classes: BalanceReportModel["classes"], add: (finding: BalanceFinding) => void): void {
  for (const { preset: tier } of REPORT_TIERS) {
    const rates = classes.filter((row) => row.rates[tier].n > 0).map((row) => row.rates[tier].winRate);
    if (rates.length < 2) continue;
    const med = median(rates);
    for (const row of classes) {
      if (row.rates[tier].n <= 0) continue;
      if (Math.abs(row.rates[tier].winRate - med) < EQUITY_SPREAD) continue;
      add({
        severity: "serious",
        scope: "class",
        id: row.id,
        title: titleClass(row.id),
        tier,
        metric: "winRate",
        bucket: "equity",
        observed: row.rates[tier].winRate,
        band: `within ${EQUITY_SPREAD * 100}% of class median (${(med * 100).toFixed(1)}%)`,
        worstScenario: `${titleClass(row.id)} overall (${tier})`,
        recommendation: `This class is 15pp+ from the class median (same power budget).${REVIEW_SUFFIX}`,
      });
    }
  }
}

function collectMatchupFindings(model: BalanceReportModel, add: (finding: BalanceFinding) => void): void {
  const byEnemy = new Map<string, ClassMatchupRow[]>();
  for (const row of model.classMatchups) {
    const list = byEnemy.get(row.enemyId) ?? [];
    list.push(row);
    byEnemy.set(row.enemyId, list);
  }

  for (const [enemyId, rows] of byEnemy) {
    const enemyType = rows[0]?.enemyType ?? enemyTypeOf(enemyId);
    for (const { preset: tier } of REPORT_TIERS) {
      const cells = rows.map((row) => ({ row, cell: row.rates[tier] })).filter((entry) => entry.cell.n > 0);
      if (cells.length === 0) continue;
      const rates = cells.map((entry) => entry.cell.winRate);
      const med = median(rates);
      const clustered = rates.every((rate) => Math.abs(rate - med) < 0.01);

      const turnRates = cells.map((entry) => entry.cell.averageTurns);
      const turnMed = median(turnRates);

      for (const { row, cell } of cells) {
        const spread = Math.abs(cell.winRate - med);
        const turnSpread = Math.abs(cell.averageTurns - turnMed);
        const effectiveEnemyType = row.enemyType || enemyType;

        if (!clustered && spread >= EQUITY_SPREAD) {
          collectRateFindings({
            add,
            scope: "matchup",
            id: `${row.characterId}:${row.enemyId}`,
            title: `${titleClass(row.characterId)} vs ${titleEnemy(row.enemyId)}`,
            tier,
            cell,
            enemyType: effectiveEnemyType,
            worstScenario: `${titleClass(row.characterId)} vs ${titleEnemy(row.enemyId)} (${tier})`,
            ...(ENEMY_CAUSE_HINTS[row.enemyId] ? { causeHint: ENEMY_CAUSE_HINTS[row.enemyId] } : {}),
          });
          add({
            severity: "serious",
            scope: "matchup",
            id: `${row.characterId}:${row.enemyId}`,
            title: `${titleClass(row.characterId)} vs ${titleEnemy(row.enemyId)}`,
            tier,
            metric: "winRate",
            bucket: "equity",
            observed: cell.winRate,
            band: `within ${EQUITY_SPREAD * 100}% of this enemy's class median (${(med * 100).toFixed(1)}%)`,
            worstScenario: `${titleClass(row.characterId)} vs ${titleEnemy(row.enemyId)} (${tier})`,
            ...(ENEMY_CAUSE_HINTS[row.enemyId] ? { causeHint: ENEMY_CAUSE_HINTS[row.enemyId] } : {}),
            recommendation: `This matchup is 15pp+ from other classes vs the same enemy.${REVIEW_SUFFIX}`,
          });
        } else if (
          effectiveEnemyType &&
          turnSpread >= MATCHUP_TURN_SPREAD_THRESHOLD &&
          isLengthOutsideBand(cell.averageTurns, effectiveEnemyType)
        ) {
          collectRateFindings({
            add,
            scope: "matchup",
            id: `${row.characterId}:${row.enemyId}`,
            title: `${titleClass(row.characterId)} vs ${titleEnemy(row.enemyId)}`,
            tier,
            cell,
            enemyType: effectiveEnemyType,
            worstScenario: `${titleClass(row.characterId)} vs ${titleEnemy(row.enemyId)} (${tier})`,
            ...(ENEMY_CAUSE_HINTS[row.enemyId] ? { causeHint: ENEMY_CAUSE_HINTS[row.enemyId] } : {}),
          });
        }
      }
    }
  }
}

function collectPairedFindings(
  rows: readonly PairedTierRow[],
  scope: FindingScope,
  titleOf: (id: string) => string,
  add: (finding: BalanceFinding) => void,
  context = "",
): void {
  for (const { preset: tier } of REPORT_TIERS) {
    const usable = rows.map((row) => ({ row, delta: row.deltas[tier] })).filter((entry) => entry.delta.n >= 2);
    if (usable.length === 0) continue;
    const med = median(usable.map((entry) => entry.delta.delta));
    const turnMed = median(usable.map((entry) => entry.delta.turnDelta));
    for (const { row, delta } of usable) {
      const label = context ? `${titleOf(row.id)} (${context})` : titleOf(row.id);
      if (!delta.noisy && Math.abs(delta.delta - med) >= PAIRED_DELTA_FROM_MEDIAN) {
        add({
          severity: "serious",
          scope,
          id: context ? `${row.id}:${context}` : row.id,
          title: label,
          tier,
          metric: "delta",
          bucket: "paired",
          observed: delta.delta,
          band: `noisy skipped; |delta − median| ≥ ${PAIRED_DELTA_FROM_MEDIAN * 100}pp (median ${(med * 100).toFixed(1)}pp)`,
          worstScenario: `${label} (${tier})`,
          recommendation: `Non-noisy paired delta is far from the category median.${REVIEW_SUFFIX}`,
        });
      }
      if (
        !isDeltaNoisy(delta.turnDelta, delta.turnSe) &&
        Math.abs(delta.turnDelta - turnMed) >= PAIRED_TURN_DELTA_THRESHOLD
      ) {
        add({
          severity: "serious",
          scope,
          id: context ? `${row.id}:${context}:turns` : `${row.id}:turns`,
          title: label,
          tier,
          metric: "averageTurns",
          bucket: "length",
          observed: delta.turnDelta,
          band: `|turn delta − median| ≥ ${PAIRED_TURN_DELTA_THRESHOLD.toFixed(1)} rounds (median ${turnMed.toFixed(1)})`,
          worstScenario: `${label} (${tier}) · turn impact: ${delta.turnDelta >= 0 ? "+" : ""}${delta.turnDelta.toFixed(1)} rounds`,
          recommendation:
            delta.turnDelta > 0
              ? `Increases observed fight duration by ${delta.turnDelta.toFixed(1)} rounds.${REVIEW_SUFFIX}`
              : `Reduces observed fight duration by ${Math.abs(delta.turnDelta).toFixed(1)} rounds.${REVIEW_SUFFIX}`,
        });
      }
    }
  }
}

function collectAnomalies(model: BalanceReportModel, add: (finding: BalanceFinding) => void): void {
  for (const row of model.anomalyMetrics) {
    for (const { preset: tier } of REPORT_TIERS) {
      const value = row.values[tier];
      const threshold = ANOMALY_THRESHOLD_BY_PRESET[tier];
      if (value <= threshold) continue;
      const peak = model.anomalies.find((entry) => entry.field === row.field);
      const burnHint =
        row.field.includes("Burn") || row.field.includes("Player→Enemy")
          ? "Burn stack application (e.g. Flaming Shield) can spike vs Burn-vulnerable enemies."
          : undefined;
      add({
        severity: "watch",
        scope: "anomaly",
        id: row.field,
        title: row.field,
        tier,
        metric: "anomaly",
        bucket: "anomaly",
        observed: value,
        band: `≤ ${threshold} (${tier})`,
        worstScenario: peak?.peakScenario ?? row.field,
        ...(burnHint ? { causeHint: burnHint } : {}),
        recommendation: `Peak value exceeds the anomaly threshold.${REVIEW_SUFFIX}`,
      });
    }
  }
}

export function evaluateBalanceFindings(
  model: BalanceReportModel,
  options?: Partial<ReportRunOptions>,
): BalanceFindingsReport {
  return selectBalanceFindings(collectBalanceFindings(model), options?.findingsCap ?? FINDINGS_CAP);
}
