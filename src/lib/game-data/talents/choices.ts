/**
 * Talent pool queries and row-based unlock eligibility.
 *
 * The talent grid is laid out as stacked rows of [1, 2, 3, 4] nodes in pool
 * order. A row is unlocked once every real talent in the rows above it is
 * unlocked; placeholder ("Coming Soon") nodes never participate in progression.
 */
import { keywordDefinitions } from "../keywords";
import type { KeywordId } from "../types";
import { talentPool } from "./pool";
import { isTalentPlaceholder, type TalentDefinition } from "./types";

/** Fixed row sizes for the 1 / 2 / 3 / 4 talent grid. */
export const TALENT_ROW_SIZES = [1, 2, 3, 4] as const;

/** Keywords shown in the talent tree and counted for unspent-point badges. */
export function getTalentTreeKeywordIds(): KeywordId[] {
  return (Object.keys(keywordDefinitions) as KeywordId[]).filter((kw) => countImplementedTalents(kw) > 0);
}

export function getTalentsForKeyword(keywordId: KeywordId): TalentDefinition[] {
  return talentPool.filter((t) => t.keywordId === keywordId);
}

function getImplementedTalentsForKeyword(keywordId: KeywordId): TalentDefinition[] {
  return getTalentsForKeyword(keywordId).filter((t) => !isTalentPlaceholder(t));
}

export function countImplementedTalents(keywordId: KeywordId): number {
  return getImplementedTalentsForKeyword(keywordId).length;
}

/** Index of the row containing the given position in the grid (0-based). */
export function getTalentRowIndex(index: number): number {
  let cumulative = 0;
  for (let row = 0; row < TALENT_ROW_SIZES.length; row++) {
    cumulative += TALENT_ROW_SIZES[row]!;
    if (index < cumulative) return row;
  }
  return TALENT_ROW_SIZES.length - 1;
}

/** The full 1 / 2 / 3 / 4 grid for a keyword, in pool order (placeholders included). */
export function getTalentRows(keywordId: KeywordId): TalentDefinition[][] {
  const talents = getTalentsForKeyword(keywordId);
  const rows: TalentDefinition[][] = [];
  let index = 0;
  for (const size of TALENT_ROW_SIZES) {
    rows.push(talents.slice(index, index + size));
    index += size;
  }
  return rows;
}

/** True when every real talent in rows above the given row is unlocked. */
export function isTalentRowUnlocked(keywordId: KeywordId, unlockedIds: string[], rowIndex: number): boolean {
  const talents = getTalentsForKeyword(keywordId);
  const unlocked = new Set(unlockedIds);
  let index = 0;
  for (let row = 0; row < rowIndex; row++) {
    for (const talent of talents.slice(index, index + TALENT_ROW_SIZES[row]!)) {
      if (!isTalentPlaceholder(talent) && !unlocked.has(talent.id)) return false;
    }
    index += TALENT_ROW_SIZES[row]!;
  }
  return true;
}

/** Real talents whose row is unlocked and that have not been allocated yet. */
export function getAllocatableTalentChoices(keywordId: KeywordId, unlockedIds: string[]): TalentDefinition[] {
  const talents = getTalentsForKeyword(keywordId);
  const unlocked = new Set(unlockedIds);
  return talents.filter(
    (talent, index) =>
      !isTalentPlaceholder(talent) &&
      !unlocked.has(talent.id) &&
      isTalentRowUnlocked(keywordId, unlockedIds, getTalentRowIndex(index)),
  );
}
