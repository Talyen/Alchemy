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

export function getTalentRows(keywordId: KeywordId): TalentDefinition[][] {
  return chunkIntoRows(getTalentsForKeyword(keywordId), TALENT_ROW_SIZES);
}

export function getAllocatableTalentChoices(keywordId: KeywordId, unlockedIds: string[]): TalentDefinition[] {
  const unlocked = new Set(unlockedIds);
  for (const row of getTalentRows(keywordId)) {
    const missing = row.filter((talent) => !isTalentPlaceholder(talent) && !unlocked.has(talent.id));
    if (missing.length) return missing;
  }
  return [];
}
