import { enemyById, isEnemyId, talentPool } from "@/lib/game-data";
import { ANOMALY_THRESHOLD_BY_PRESET } from "./anomalies";
import {
  EQUITY_SPREAD,
  FINDINGS_CAP,
  LENGTH_BAND_BY_TYPE,
  MATERIAL_TIMEOUT_RATE,
  PAIRED_DELTA_FROM_MEDIAN,
  formatLengthBand,
  formatWinRateBand,
  isLengthOutsideBand,
  isWinRateFloorOrCeiling,
  isWinRateOutsideTypeBand,
  WIN_RATE_BAND_BY_TYPE,
  type EnemyTypeBand,
  type FindingsTier,
} from "./findings-bands";
import type { BalanceReportModel, ClassMatchupRow, PairedTierRow, TierRateRow } from "./report-model";
import type { RateCell } from "./report-rankings";
import { REPORT_ENEMY_TYPES, REPORT_TIERS, TITLE_LOOKUPS } from "./report-catalog";

type FindingSeverity = "critical" | "serious" | "watch";
type FindingScope = "enemy" | "class" | "matchup" | "card" | "talent" | "companion" | "boon" | "anomaly";
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
  omitted: number;
  totalBeforeCap: number;
  shownByBucket: Record<FindingBucket, number>;
  omittedByBucket: Record<FindingBucket, number>;
}

const SEVERITY_RANK: Record<FindingSeverity, number> = { critical: 0, serious: 1, watch: 2 };

const APPLY_TYPE_WIN_BAND: Record<FindingsTier, boolean> = {
  early: false,
  mid: true,
  late: true,
};

const ENEMY_CAUSE_HINTS: Record<string, string> = {
  "iron-bear": "Iron Hide grants armor, forge, or burn every other enemy turn.",
  frostwarden: "Glacial Shell: half Freeze, 50% more Burn, freeze bonus every other turn.",
  "forge-golem": "Rusting Carapace grants Forge every other turn; starts with Block.",
  "blight-treant": "Regeneration plus Burn vulnerability.",
  "fire-elemental": "Cinder Skin deals Burn when attacked.",
  "living-armor": "Starts combat with Armor; 25% less Bleed.",
  slime: "Amorphous: 10% less Physical and Poison.",
  necromancer: "Bleed attack; Holy vulnerability.",
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
  return TITLE_LOOKUPS.enemy[id] ?? id;
}

function titleClass(id: string): string {
  return TITLE_LOOKUPS.character[id] ?? id;
}

function titleCard(id: string): string {
  return TITLE_LOOKUPS.card[id] ?? id;
}

function titleBoon(id: string): string {
  return TITLE_LOOKUPS.boon[id] ?? id;
}

function titleCompanion(id: string): string {
  return TITLE_LOOKUPS.companion[id] ?? id;
}

function titleTalent(id: string): string {
  return talentPool.find((talent) => talent.id === id)?.name ?? id;
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

function findingKey(finding: BalanceFinding): string {
  return `${finding.scope}:${finding.id}:${finding.tier}:${finding.metric}`;
}

function keepBetter(existing: BalanceFinding | undefined, next: BalanceFinding): BalanceFinding {
  if (!existing) return next;
  if (SEVERITY_RANK[next.severity] < SEVERITY_RANK[existing.severity]) return next;
  return existing;
}

function scoreFinding(finding: BalanceFinding): number {
  const severity = (2 - SEVERITY_RANK[finding.severity]) * 10;
  switch (finding.metric) {
    case "winRate":
      return severity + Math.abs(finding.observed - 0.85);
    case "averageTurns":
      return severity + Math.abs(finding.observed - 6) / 10;
    case "timeoutRate":
      return severity + finding.observed;
    case "delta":
      return severity + Math.abs(finding.observed);
    case "anomaly":
      return severity + finding.observed / 1000;
    default:
      return severity;
  }
}

export function evaluateBalanceFindings(model: BalanceReportModel): BalanceFindingsReport {
  const byKey = new Map<string, BalanceFinding>();

  function add(finding: BalanceFinding): void {
    const key = findingKey(finding);
    byKey.set(key, keepBetter(byKey.get(key), finding));
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

    for (const enemyType of REPORT_ENEMY_TYPES) {
      const cell = row.ratesByType.late[enemyType];
      if (cell.n <= 0) continue;
      collectRateFindings({
        add,
        scope: "class",
        id: `${row.id}:${enemyType}`,
        title: `${titleClass(row.id)} vs ${enemyType}`,
        tier: "late",
        cell,
        enemyType,
        worstScenario: `${titleClass(row.id)} vs ${enemyType} (late)`,
      });
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
  collectAnomalies(model, add);

  const ranked = [...byKey.values()].sort((a, b) => scoreFinding(b) - scoreFinding(a) || a.id.localeCompare(b.id));
  const collapsed = collapseMatchupClusters(ranked);
  const selected = selectDiverseFindings(collapsed, FINDINGS_CAP);
  const shownByBucket = emptyBucketCounts();
  const omittedByBucket = emptyBucketCounts();
  for (const finding of collapsed) {
    omittedByBucket[finding.bucket] += 1;
  }
  for (const finding of selected) {
    shownByBucket[finding.bucket] += 1;
    omittedByBucket[finding.bucket] -= 1;
  }
  return {
    findings: orderFindingsForDisplay(selected),
    omitted: Math.max(0, collapsed.length - selected.length),
    totalBeforeCap: collapsed.length,
    shownByBucket,
    omittedByBucket,
  };
}

function emptyBucketCounts(): Record<FindingBucket, number> {
  return {
    timeout: 0,
    floorCeiling: 0,
    typeWinRate: 0,
    length: 0,
    equity: 0,
    paired: 0,
    anomaly: 0,
  };
}

function matchupEnemyId(finding: BalanceFinding): string {
  const sep = finding.id.indexOf(":");
  return sep === -1 ? finding.id : finding.id.slice(sep + 1);
}

function collapseMatchupClusters(findings: readonly BalanceFinding[]): BalanceFinding[] {
  const kept: BalanceFinding[] = [];
  const groups = new Map<string, BalanceFinding[]>();
  for (const finding of findings) {
    if (finding.scope !== "matchup") {
      kept.push(finding);
      continue;
    }
    const key = `${matchupEnemyId(finding)}:${finding.tier}:${finding.metric}:${finding.bucket}`;
    const list = groups.get(key) ?? [];
    list.push(finding);
    groups.set(key, list);
  }
  for (const group of groups.values()) {
    const sorted = [...group].sort((a, b) => scoreFinding(b) - scoreFinding(a) || a.id.localeCompare(b.id));
    const best = sorted[0];
    if (!best) continue;
    if (sorted.length === 1) {
      kept.push(best);
      continue;
    }
    kept.push({
      ...best,
      clusterSize: sorted.length,
      worstScenario: `${best.worstScenario} · worst of ${sorted.length} classes`,
    });
  }
  return kept.sort((a, b) => scoreFinding(b) - scoreFinding(a) || a.id.localeCompare(b.id));
}

function selectDiverseFindings(ranked: readonly BalanceFinding[], cap: number): BalanceFinding[] {
  const queues = new Map<FindingBucket, BalanceFinding[]>();
  for (const bucket of FINDING_BUCKET_ORDER) queues.set(bucket, []);
  for (const finding of ranked) {
    queues.get(finding.bucket)?.push(finding);
  }
  const shown: BalanceFinding[] = [];
  const seen = new Set<string>();
  while (shown.length < cap) {
    let added = false;
    for (const bucket of FINDING_BUCKET_ORDER) {
      const queue = queues.get(bucket);
      const next = queue?.shift();
      if (!next) continue;
      const key = findingKey(next);
      if (seen.has(key)) continue;
      seen.add(key);
      shown.push(next);
      added = true;
      if (shown.length >= cap) break;
    }
    if (!added) break;
  }
  return shown;
}

function orderFindingsForDisplay(findings: readonly BalanceFinding[]): BalanceFinding[] {
  const bucketRank = Object.fromEntries(FINDING_BUCKET_ORDER.map((bucket, index) => [bucket, index])) as Record<
    FindingBucket,
    number
  >;
  return [...findings].sort(
    (a, b) =>
      bucketRank[a.bucket] - bucketRank[b.bucket] || scoreFinding(b) - scoreFinding(a) || a.id.localeCompare(b.id),
  );
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
  } else if (enemyType && APPLY_TYPE_WIN_BAND[tier] && isWinRateOutsideTypeBand(cell.winRate, enemyType)) {
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
  for (const enemyType of REPORT_ENEMY_TYPES) {
    const rows = byType[enemyType];
    const rates = rows.map((row) => row.rates.late.winRate).filter((_, i) => (rows[i]?.rates.late.n ?? 0) > 0);
    if (rates.length < 2) continue;
    const med = median(rates);
    for (const row of rows) {
      if (row.rates.late.n <= 0) continue;
      const spread = Math.abs(row.rates.late.winRate - med);
      if (spread < EQUITY_SPREAD) continue;
      add({
        severity: "serious",
        scope: "enemy",
        id: row.id,
        title: titleEnemy(row.id),
        tier: "late",
        metric: "winRate",
        bucket: "equity",
        observed: row.rates.late.winRate,
        band: `within ${EQUITY_SPREAD * 100}% of ${enemyType} median (${(med * 100).toFixed(1)}%)`,
        worstScenario: `${titleEnemy(row.id)} (late)`,
        ...(ENEMY_CAUSE_HINTS[row.id] ? { causeHint: ENEMY_CAUSE_HINTS[row.id] } : {}),
        recommendation: `This ${enemyType} is 15pp+ from the type median (same power budget).${REVIEW_SUFFIX}`,
      });
    }
  }
}

function collectClassEquity(classes: BalanceReportModel["classes"], add: (finding: BalanceFinding) => void): void {
  const rates = classes.filter((row) => row.rates.late.n > 0).map((row) => row.rates.late.winRate);
  if (rates.length < 2) return;
  const med = median(rates);
  for (const row of classes) {
    if (row.rates.late.n <= 0) continue;
    if (Math.abs(row.rates.late.winRate - med) < EQUITY_SPREAD) continue;
    add({
      severity: "serious",
      scope: "class",
      id: row.id,
      title: titleClass(row.id),
      tier: "late",
      metric: "winRate",
      bucket: "equity",
      observed: row.rates.late.winRate,
      band: `within ${EQUITY_SPREAD * 100}% of class median (${(med * 100).toFixed(1)}%)`,
      worstScenario: `${titleClass(row.id)} overall (late)`,
      recommendation: `This class is 15pp+ from the class median (same power budget).${REVIEW_SUFFIX}`,
    });
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

      for (const { row, cell } of cells) {
        const spread = Math.abs(cell.winRate - med);
        if (clustered || spread < EQUITY_SPREAD) continue;
        collectRateFindings({
          add,
          scope: "matchup",
          id: `${row.characterId}:${row.enemyId}`,
          title: `${titleClass(row.characterId)} vs ${titleEnemy(row.enemyId)}`,
          tier,
          cell,
          enemyType: row.enemyType || enemyType,
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
      }
    }
  }
}

function collectPairedFindings(
  rows: readonly PairedTierRow[],
  scope: "card" | "talent" | "companion" | "boon",
  titleOf: (id: string) => string,
  add: (finding: BalanceFinding) => void,
  context = "",
): void {
  for (const { preset: tier } of REPORT_TIERS) {
    const usable = rows
      .map((row) => ({ row, delta: row.deltas[tier] }))
      .filter((entry) => entry.delta.n > 0 && !entry.delta.noisy);
    if (usable.length === 0) continue;
    const med = median(usable.map((entry) => entry.delta.delta));
    for (const { row, delta } of usable) {
      if (Math.abs(delta.delta - med) < PAIRED_DELTA_FROM_MEDIAN) continue;
      const label = context ? `${titleOf(row.id)} (${context})` : titleOf(row.id);
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
