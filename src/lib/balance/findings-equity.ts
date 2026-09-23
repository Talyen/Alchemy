import type { BalanceFinding } from "./findings-types";
import { EQUITY_SPREAD, type EnemyTypeBand } from "./findings-bands";
import { REPORT_ENEMY_TYPES, REPORT_TIERS, titleFor } from "./report-catalog";
import type { BalanceReportModel, TierRateRow } from "./report-model";
import { ENEMY_CAUSE_HINTS, REVIEW_SUFFIX, enemyTypeOf, median } from "./findings-rule-helpers";

export function collectEnemyTypeEquity(enemies: readonly TierRateRow[]): BalanceFinding[] {
  const findings: BalanceFinding[] = [];
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
        const title = titleFor("enemy", row.id);
        findings.push({
          severity: "serious",
          scope: "enemy",
          id: row.id,
          title,
          tier,
          metric: "winRate",
          bucket: "equity",
          observed: row.rates[tier].winRate,
          band: `within ${EQUITY_SPREAD * 100}% of ${enemyType} median (${(med * 100).toFixed(1)}%)`,
          worstScenario: `${title} (${tier})`,
          ...(ENEMY_CAUSE_HINTS[row.id] ? { causeHint: ENEMY_CAUSE_HINTS[row.id] } : {}),
          recommendation: `This ${enemyType} is 15pp+ from the type median (same power budget).${REVIEW_SUFFIX}`,
        });
      }
    }
  }
  return findings;
}

export function collectClassEquity(classes: BalanceReportModel["classes"]): BalanceFinding[] {
  const findings: BalanceFinding[] = [];
  for (const { preset: tier } of REPORT_TIERS) {
    const rates = classes.filter((row) => row.rates[tier].n > 0).map((row) => row.rates[tier].winRate);
    if (rates.length < 2) continue;
    const med = median(rates);
    for (const row of classes) {
      if (row.rates[tier].n <= 0) continue;
      if (Math.abs(row.rates[tier].winRate - med) < EQUITY_SPREAD) continue;
      const title = titleFor("character", row.id);
      findings.push({
        severity: "serious",
        scope: "class",
        id: row.id,
        title,
        tier,
        metric: "winRate",
        bucket: "equity",
        observed: row.rates[tier].winRate,
        band: `within ${EQUITY_SPREAD * 100}% of class median (${(med * 100).toFixed(1)}%)`,
        worstScenario: `${title} overall (${tier})`,
        recommendation: `This class is 15pp+ from the class median (same power budget).${REVIEW_SUFFIX}`,
      });
    }
  }
  return findings;
}
