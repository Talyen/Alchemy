import type { BalanceFinding, FindingScope } from "./findings-types";
import {
  formatLengthBand,
  formatWinRateBand,
  isLengthOutsideBand,
  isWinRateFloorOrCeiling,
  isWinRateOutsideTypeBand,
  LENGTH_BAND_BY_TYPE,
  MATERIAL_TIMEOUT_RATE,
  WIN_RATE_BAND_BY_TYPE,
  type EnemyTypeBand,
  type FindingsTier,
} from "./findings-bands";
import type { RateCell } from "./report-rankings";
import { ENEMY_CAUSE_HINTS, REVIEW_SUFFIX, enemyTypeOf } from "./findings-rule-helpers";
import { REPORT_ENEMY_TYPES, REPORT_TIERS, titleFor } from "./report-catalog";
import type { BalanceReportModel } from "./report-model";

export function collectRateFindings(options: {
  scope: FindingScope;
  id: string;
  title: string;
  tier: FindingsTier;
  cell: RateCell;
  enemyType: EnemyTypeBand | undefined;
  worstScenario: string;
  causeHint?: string;
}): BalanceFinding[] {
  const findings: BalanceFinding[] = [];
  const { scope, id, title, tier, cell, enemyType, worstScenario, causeHint } = options;
  if (cell.n <= 0) return findings;

  if (cell.timeoutRate >= MATERIAL_TIMEOUT_RATE) {
    findings.push({
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
    findings.push({
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
    findings.push({
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
    findings.push({
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
    findings.push({
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
  return findings;
}

export function collectEnemyRateFindings(model: BalanceReportModel): BalanceFinding[] {
  const findings: BalanceFinding[] = [];
  for (const enemy of model.enemies) {
    const enemyType = enemyTypeOf(enemy.id);
    for (const { preset: tier } of REPORT_TIERS) {
      const title = titleFor("enemy", enemy.id);
      findings.push(
        ...collectRateFindings({
          scope: "enemy",
          id: enemy.id,
          title,
          tier,
          cell: enemy.rates[tier],
          enemyType,
          worstScenario: `${title} (${tier})`,
          ...(ENEMY_CAUSE_HINTS[enemy.id] ? { causeHint: ENEMY_CAUSE_HINTS[enemy.id] } : {}),
        }),
      );
    }
  }

  return findings;
}

export function collectClassRateFindings(model: BalanceReportModel): BalanceFinding[] {
  const findings: BalanceFinding[] = [];
  for (const row of model.classes) {
    const classTitle = titleFor("character", row.id);
    for (const { preset: tier } of REPORT_TIERS) {
      findings.push(
        ...collectRateFindings({
          scope: "class",
          id: row.id,
          title: classTitle,
          tier,
          cell: row.rates[tier],
          enemyType: undefined,
          worstScenario: `${classTitle} overall (${tier})`,
          ...(row.id === "wizard" || row.id === "warlock"
            ? { causeHint: "Burn (and Bleed for Warlock) can spike stacks quickly." }
            : {}),
        }),
      );
    }

    for (const { preset: tier } of REPORT_TIERS) {
      for (const enemyType of REPORT_ENEMY_TYPES) {
        const cell = row.ratesByType[tier][enemyType];
        if (cell.n <= 0) continue;
        findings.push(
          ...collectRateFindings({
            scope: "class",
            id: `${row.id}:${enemyType}`,
            title: `${classTitle} vs ${enemyType}`,
            tier,
            cell,
            enemyType,
            worstScenario: `${classTitle} vs ${enemyType} (${tier})`,
          }),
        );
      }
    }
  }

  return findings;
}
