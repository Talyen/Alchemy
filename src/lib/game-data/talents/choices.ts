import { keywordDefinitions } from "../keywords";
import type { KeywordId } from "../types";
import { getTalentsForKeyword } from "./talent-pool-definitions";
import { isTalentPlaceholder, type TalentDefinition } from "./types";

export { getTalentsForKeyword } from "./talent-pool-definitions";

export const TALENT_ROW_SIZES = [1, 2, 3, 4] as const;

export function chunkIntoRows<T>(items: T[], sizes: readonly number[] | number): T[][] {
  if (typeof sizes === "number") {
    const rows: T[][] = [];
    for (let i = 0; i < items.length; i += sizes) {
      rows.push(items.slice(i, i + sizes));
    }
    return rows;
  }
  const rows: T[][] = [];
  let index = 0;
  for (const size of sizes) {
    rows.push(items.slice(index, index + size));
    index += size;
  }
  if (index < items.length) {
    rows.push(items.slice(index));
  }
  return rows;
}

export function getTalentTreeKeywordIds(): KeywordId[] {
  return (Object.keys(keywordDefinitions) as KeywordId[]).filter((kw) => countImplementedTalents(kw) > 0);
}

function getImplementedTalentsForKeyword(keywordId: KeywordId): TalentDefinition[] {
  return getTalentsForKeyword(keywordId).filter((t) => !isTalentPlaceholder(t));
}

export function countImplementedTalents(keywordId: KeywordId): number {
  return getImplementedTalentsForKeyword(keywordId).length;
}

export function getTalentRowIndex(index: number): number {
  let cumulative = 0;
  for (const [row, size] of TALENT_ROW_SIZES.entries()) {
    cumulative += size;
    if (index < cumulative) return row;
  }
  return TALENT_ROW_SIZES.length - 1;
}

export function getTalentRows(keywordId: KeywordId): TalentDefinition[][] {
  return chunkIntoRows(getTalentsForKeyword(keywordId), TALENT_ROW_SIZES);
}

export function isTalentRowUnlocked(keywordId: KeywordId, unlockedIds: string[], rowIndex: number): boolean {
  const talents = getTalentsForKeyword(keywordId);
  const unlocked = new Set(unlockedIds);
  let index = 0;
  for (let row = 0; row < rowIndex && row < TALENT_ROW_SIZES.length; row++) {
    const size = TALENT_ROW_SIZES[row] ?? 0;
    for (const talent of talents.slice(index, index + size)) {
      if (!isTalentPlaceholder(talent) && !unlocked.has(talent.id)) return false;
    }
    index += size;
  }
  return true;
}

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
