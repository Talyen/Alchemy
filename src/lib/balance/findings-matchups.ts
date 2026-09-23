import type { BalanceFinding } from "./findings-types";
import { EQUITY_SPREAD, isLengthOutsideBand, MATCHUP_TURN_SPREAD_THRESHOLD } from "./findings-bands";
import { REPORT_TIERS, titleFor } from "./report-catalog";
import type { BalanceReportModel, ClassMatchupRow } from "./report-model";
import { ENEMY_CAUSE_HINTS, REVIEW_SUFFIX, enemyTypeOf, median } from "./findings-rule-helpers";
import { collectRateFindings } from "./findings-rate";

export function collectMatchupFindings(model: BalanceReportModel): BalanceFinding[] {
  const findings: BalanceFinding[] = [];
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
        const matchupTitle = `${titleFor("character", row.characterId)} vs ${titleFor("enemy", row.enemyId)}`;

        if (!clustered && spread >= EQUITY_SPREAD) {
          findings.push(
            ...collectRateFindings({
              scope: "matchup",
              id: `${row.characterId}:${row.enemyId}`,
              title: matchupTitle,
              tier,
              cell,
              enemyType: effectiveEnemyType,
              worstScenario: `${matchupTitle} (${tier})`,
              ...(ENEMY_CAUSE_HINTS[row.enemyId] ? { causeHint: ENEMY_CAUSE_HINTS[row.enemyId] } : {}),
            }),
          );
          findings.push({
            severity: "serious",
            scope: "matchup",
            id: `${row.characterId}:${row.enemyId}`,
            title: matchupTitle,
            tier,
            metric: "winRate",
            bucket: "equity",
            observed: cell.winRate,
            band: `within ${EQUITY_SPREAD * 100}% of this enemy's class median (${(med * 100).toFixed(1)}%)`,
            worstScenario: `${matchupTitle} (${tier})`,
            ...(ENEMY_CAUSE_HINTS[row.enemyId] ? { causeHint: ENEMY_CAUSE_HINTS[row.enemyId] } : {}),
            recommendation: `This matchup is 15pp+ from other classes vs the same enemy.${REVIEW_SUFFIX}`,
          });
        } else if (
          effectiveEnemyType &&
          turnSpread >= MATCHUP_TURN_SPREAD_THRESHOLD &&
          isLengthOutsideBand(cell.averageTurns, effectiveEnemyType)
        ) {
          findings.push(
            ...collectRateFindings({
              scope: "matchup",
              id: `${row.characterId}:${row.enemyId}`,
              title: matchupTitle,
              tier,
              cell,
              enemyType: effectiveEnemyType,
              worstScenario: `${matchupTitle} (${tier})`,
              ...(ENEMY_CAUSE_HINTS[row.enemyId] ? { causeHint: ENEMY_CAUSE_HINTS[row.enemyId] } : {}),
            }),
          );
        }
      }
    }
  }
  return findings;
}
