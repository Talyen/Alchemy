import type { CharacterId } from "@/lib/game-data";
import { REPORT_ENEMY_TYPES, reportCharacterIds, reportTierRecord, type ReportEnemyType } from "./report-catalog";
import type { BalanceReportModel, ClassMatchupRow } from "./report-model";
import { combineRateCells, topPlayedCards, type RateCell } from "./report-rankings";
import type { TalentPreset } from "./simulator-types";

export interface CoreRateRow {
  characterId: CharacterId;
  enemyId: string;
  enemyType: ReportEnemyType;
  tier: TalentPreset;
  cell: RateCell;
  cardPlayCounts: Record<string, number>;
}

export function sumCardPlayCounts(counts: ReadonlyArray<Readonly<Record<string, number>>>): Record<string, number> {
  const total: Record<string, number> = {};
  for (const batch of counts) {
    for (const [id, count] of Object.entries(batch)) total[id] = (total[id] ?? 0) + count;
  }
  return total;
}

function ratesByTier(rows: readonly CoreRateRow[]) {
  return reportTierRecord((tier) => combineRateCells(rows.filter((row) => row.tier === tier).map((row) => row.cell)));
}

function groupRows<K>(rows: readonly CoreRateRow[], keyOf: (row: CoreRateRow) => K): Map<K, CoreRateRow[]> {
  const groups = new Map<K, CoreRateRow[]>();
  for (const row of rows) {
    const key = keyOf(row);
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }
  return groups;
}

export function equalWeightByType(byType: Readonly<Record<ReportEnemyType, RateCell>>): RateCell {
  return combineRateCells(
    REPORT_ENEMY_TYPES.map((type) => byType[type]),
    "groups",
  );
}

function buildClassMatchups(rows: readonly CoreRateRow[]): ClassMatchupRow[] {
  const groups = groupRows(rows, (row) => `${row.characterId}|${row.enemyId}|${row.enemyType}`);

  return [...groups.values()]
    .map((matching) => {
      const { characterId, enemyId, enemyType } = matching[0]!;
      return {
        characterId,
        enemyId,
        enemyType,
        rates: ratesByTier(matching),
        topCardsLate: topPlayedCards(
          sumCardPlayCounts(matching.filter((row) => row.tier === "late").map((row) => row.cardPlayCounts)),
        ),
      };
    })
    .sort(
      (left, right) =>
        left.characterId.localeCompare(right.characterId) ||
        left.rates.late.winRate - right.rates.late.winRate ||
        left.enemyId.localeCompare(right.enemyId),
    );
}

export function summarizeCoreRates(
  rows: readonly CoreRateRow[],
): Pick<BalanceReportModel, "enemies" | "classes" | "classMatchups"> {
  const byEnemy = groupRows(rows, (row) => row.enemyId);
  const byCharacter = groupRows(rows, (row) => row.characterId);

  const enemies = [...byEnemy].map(([id, matching]) => ({ id, rates: ratesByTier(matching) }));
  const classes = reportCharacterIds().map((id) => {
    const matching = byCharacter.get(id) ?? [];
    const ratesByType = reportTierRecord((tier) => {
      const tierRows = matching.filter((row) => row.tier === tier);
      const rateForType = (type: ReportEnemyType) =>
        combineRateCells(tierRows.filter((row) => row.enemyType === type).map((row) => row.cell));
      return { normal: rateForType("normal"), elite: rateForType("elite"), boss: rateForType("boss") };
    });
    return { id, rates: reportTierRecord((tier) => equalWeightByType(ratesByType[tier])), ratesByType };
  });
  return {
    enemies: enemies.sort((a, b) => a.rates.late.winRate - b.rates.late.winRate),
    classes: classes.sort((a, b) => a.rates.late.winRate - b.rates.late.winRate),
    classMatchups: buildClassMatchups(rows),
  };
}
