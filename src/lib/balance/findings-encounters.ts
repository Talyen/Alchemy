import { enemyById, isEnemyId } from "@/lib/game-data";
import {
  EQUITY_SPREAD,
  formatLengthBand,
  formatWinRateBand,
  isLengthOutsideBand,
  isWinRateFloorOrCeiling,
  isWinRateOutsideTypeBand,
  LENGTH_BAND_BY_TYPE,
  MATCHUP_TURN_SPREAD_THRESHOLD,
  MATERIAL_TIMEOUT_RATE,
  WIN_RATE_BAND_BY_TYPE,
  type BalanceFinding,
  type EnemyTypeBand,
  type FindingsTier,
} from "./findings-types";
import { finding, median, type FindingContext, type FindingDetails } from "./findings-shared";
import { REPORT_ENEMY_TYPES, REPORT_TIERS, titleFor } from "./report-catalog";
import type { BalanceReportModel, ClassMatchupRow, TierRateRow } from "./report-model";
import type { RateCell } from "./report-rankings";

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

function enemyCauseHint(id: string): Pick<FindingContext, "causeHint"> {
  const causeHint = ENEMY_CAUSE_HINTS[id];
  return causeHint ? { causeHint } : {};
}

function enemyTypeOf(id: string): EnemyTypeBand | undefined {
  return isEnemyId(id) ? enemyById[id].enemyType : undefined;
}

function collectRateFindings({
  cell,
  enemyType,
  ...context
}: FindingContext & { cell: RateCell; enemyType: EnemyTypeBand | undefined }): BalanceFinding[] {
  const details: FindingDetails[] = [];
  if (cell.n <= 0) return [];

  if (cell.timeoutRate >= MATERIAL_TIMEOUT_RATE) {
    details.push({
      severity: "critical",
      metric: "timeoutRate",
      bucket: "timeout",
      observed: cell.timeoutRate,
      band: `< ${(MATERIAL_TIMEOUT_RATE * 100).toFixed(0)}% timeouts`,
      recommendation: "Fights hit the 30-turn cap (stall).",
    });
  }

  if (isWinRateFloorOrCeiling(cell.winRate)) {
    details.push({
      severity: "critical",
      metric: "winRate",
      bucket: "floorCeiling",
      observed: cell.winRate,
      band: "never 0% or 100%",
      recommendation: "Win rate is a floor or ceiling.",
    });
  } else if (enemyType && isWinRateOutsideTypeBand(cell.winRate, enemyType)) {
    const tooLow = cell.winRate < WIN_RATE_BAND_BY_TYPE[enemyType].min;
    const hardBoss = enemyType === "boss" && tooLow;
    details.push({
      severity: hardBoss ? "critical" : "serious",
      metric: "winRate",
      bucket: "typeWinRate",
      observed: cell.winRate,
      band: formatWinRateBand(enemyType),
      recommendation: hardBoss
        ? "Boss win rate is below 70%."
        : `Win rate is ${tooLow ? "below" : "above"} the ${enemyType} band.`,
    });
  }

  if (enemyType && isLengthOutsideBand(cell.averageTurns, enemyType)) {
    const tooShort = cell.averageTurns < LENGTH_BAND_BY_TYPE[enemyType].min;
    details.push({
      severity: "serious",
      metric: "averageTurns",
      bucket: "length",
      observed: cell.averageTurns,
      band: formatLengthBand(enemyType),
      recommendation: `Fight is ${tooShort ? "shorter" : "longer"} than the ${enemyType} length band.`,
    });
  }
  return details.map((detail) => finding(context, detail));
}

function collectEnemyRateFindings(model: BalanceReportModel): BalanceFinding[] {
  return model.enemies.flatMap((enemy) =>
    REPORT_TIERS.flatMap(({ preset: tier }) => {
      const title = titleFor("enemy", enemy.id);
      return collectRateFindings({
        scope: "enemy",
        id: enemy.id,
        title,
        tier,
        cell: enemy.rates[tier],
        enemyType: enemyTypeOf(enemy.id),
        worstScenario: `${title} (${tier})`,
        ...enemyCauseHint(enemy.id),
      });
    }),
  );
}

function collectClassRateFindings(model: BalanceReportModel): BalanceFinding[] {
  return model.classes.flatMap((row) => {
    const title = titleFor("character", row.id);
    return [
      ...REPORT_TIERS.flatMap(({ preset: tier }) =>
        collectRateFindings({
          scope: "class",
          id: row.id,
          title,
          tier,
          cell: row.rates[tier],
          enemyType: undefined,
          worstScenario: `${title} overall (${tier})`,
          ...(row.id === "wizard" || row.id === "warlock"
            ? { causeHint: "Burn (and Bleed for Warlock) can spike stacks quickly." }
            : {}),
        }),
      ),
      ...REPORT_TIERS.flatMap(({ preset: tier }) =>
        REPORT_ENEMY_TYPES.flatMap((enemyType) =>
          collectRateFindings({
            scope: "class",
            id: `${row.id}:${enemyType}`,
            title: `${title} vs ${enemyType}`,
            tier,
            cell: row.ratesByType[tier][enemyType],
            enemyType,
            worstScenario: `${title} vs ${enemyType} (${tier})`,
          }),
        ),
      ),
    ];
  });
}

function collectEquityFindings(
  rows: readonly TierRateRow[],
  tier: FindingsTier,
  enemyType?: EnemyTypeBand,
): BalanceFinding[] {
  const scope = enemyType ? "enemy" : "class";
  const sampled = rows.filter((row) => row.rates[tier].n > 0);
  if (sampled.length < 2) return [];
  const med = median(sampled.map((row) => row.rates[tier].winRate));
  const pool = enemyType ? `${enemyType} median` : "class median";
  return sampled.flatMap((row) => {
    const observed = row.rates[tier].winRate;
    if (Math.abs(observed - med) < EQUITY_SPREAD) return [];
    const title = titleFor(scope === "enemy" ? "enemy" : "character", row.id);
    return [
      finding(
        {
          scope,
          id: row.id,
          title,
          tier,
          worstScenario: `${title}${scope === "class" ? " overall" : ""} (${tier})`,
          ...(scope === "enemy" ? enemyCauseHint(row.id) : {}),
        },
        {
          severity: "serious",
          metric: "winRate",
          bucket: "equity",
          observed,
          band: `within ${EQUITY_SPREAD * 100}% of ${pool} (${(med * 100).toFixed(1)}%)`,
          recommendation: `This ${enemyType ?? "class"} is 15pp+ from the ${enemyType ? "type" : "class"} median (same power budget).`,
        },
      ),
    ];
  });
}

function collectEnemyTypeEquity(enemies: readonly TierRateRow[]): BalanceFinding[] {
  const byType: Record<EnemyTypeBand, TierRateRow[]> = { normal: [], elite: [], boss: [] };
  for (const enemy of enemies) {
    const enemyType = enemyTypeOf(enemy.id);
    if (enemyType) byType[enemyType].push(enemy);
  }
  return REPORT_TIERS.flatMap(({ preset: tier }) =>
    REPORT_ENEMY_TYPES.flatMap((type) => collectEquityFindings(byType[type], tier, type)),
  );
}

function collectMatchupFindings(model: BalanceReportModel): BalanceFinding[] {
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

        const context: FindingContext = {
          scope: "matchup",
          id: `${row.characterId}:${row.enemyId}`,
          title: matchupTitle,
          tier,
          worstScenario: `${matchupTitle} (${tier})`,
          ...enemyCauseHint(row.enemyId),
        };
        const equityOutlier = !clustered && spread >= EQUITY_SPREAD;
        const lengthOutlier =
          effectiveEnemyType &&
          turnSpread >= MATCHUP_TURN_SPREAD_THRESHOLD &&
          isLengthOutsideBand(cell.averageTurns, effectiveEnemyType);
        if (equityOutlier || lengthOutlier) {
          findings.push(...collectRateFindings({ ...context, cell, enemyType: effectiveEnemyType }));
        }
        if (equityOutlier) {
          findings.push(
            finding(context, {
              severity: "serious",
              metric: "winRate",
              bucket: "equity",
              observed: cell.winRate,
              band: `within ${EQUITY_SPREAD * 100}% of this enemy's class median (${(med * 100).toFixed(1)}%)`,
              recommendation: "This matchup is 15pp+ from other classes vs the same enemy.",
            }),
          );
        }
      }
    }
  }
  return findings;
}

export function collectEncounterFindings(model: BalanceReportModel): BalanceFinding[] {
  return [
    ...collectEnemyRateFindings(model),
    ...collectEnemyTypeEquity(model.enemies),
    ...collectClassRateFindings(model),
    ...REPORT_TIERS.flatMap(({ preset: tier }) => collectEquityFindings(model.classes, tier)),
    ...collectMatchupFindings(model),
  ];
}
