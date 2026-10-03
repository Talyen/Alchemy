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

export function countImplementedTalents(keywordId: KeywordId): number {
  let count = 0;
  for (const talent of getTalentsForKeyword(keywordId)) {
    if (!isTalentPlaceholder(talent)) count++;
  }
  return count;
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
  const unlocked = new Set(unlockedIds);
  for (const [row, talents] of getTalentRows(keywordId).entries()) {
    if (row >= rowIndex || row >= TALENT_ROW_SIZES.length) break;
    if (talents.some((talent) => !isTalentPlaceholder(talent) && !unlocked.has(talent.id))) return false;
  }
  return true;
}

export function getAllocatableTalentChoices(keywordId: KeywordId, unlockedIds: string[]): TalentDefinition[] {
  const unlocked = new Set(unlockedIds);
  const rows = getTalentRows(keywordId);
  // Overflow entries use the final authored row's gate, like getTalentRowIndex.
  const finalRow = TALENT_ROW_SIZES.length - 1;
  const gateRows = [...rows.slice(0, finalRow), rows.slice(finalRow).flat()];
  for (const row of gateRows) {
    const missing = row.filter((talent) => !isTalentPlaceholder(talent) && !unlocked.has(talent.id));
    if (missing.length > 0) return missing;
  }
  return [];
}
