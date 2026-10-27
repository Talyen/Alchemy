import { keywordDefinitions } from "../keywords";
import type { KeywordId } from "../types";
import { talentPoolByKeyword } from "./talent-pool-definitions";
import { TALENT_TREE_KEYWORD_IDS } from "./xp-keywords";
import type { TalentDefinition } from "./types";

export { getTalentsForKeyword } from "./talent-pool-definitions";

export const TALENT_ROW_SIZES = [1, 2, 3, 4] as const;

export function chunkIntoRows<T>(items: T[], sizes: readonly number[] | number): T[][] {
  const invalid = (size: number) => !Number.isSafeInteger(size) || size <= 0;
  if (typeof sizes === "number" ? invalid(sizes) : sizes.some(invalid)) {
    throw new RangeError("Row sizes must be positive safe integers");
  }
  const rows: T[][] = [];
  if (typeof sizes === "number") {
    for (let index = 0; index < items.length; index += sizes) rows.push(items.slice(index, index + sizes));
    return rows;
  }
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

const TALENT_TREE_KEYWORDS = Object.freeze(
  (Object.keys(keywordDefinitions) as KeywordId[]).filter((kw) => TALENT_TREE_KEYWORD_IDS.has(kw)),
);

export function getTalentTreeKeywordIds(): KeywordId[] {
  return [...TALENT_TREE_KEYWORDS];
}

/** Internal read-only projection for callers that do not mutate the list. */
export function getTalentTreeKeywordView(): readonly KeywordId[] {
  return TALENT_TREE_KEYWORDS;
}

export function countImplementedTalents(keywordId: KeywordId): number {
  return talentPoolByKeyword.get(keywordId)?.length ?? 0;
}

export function getTalentRows(keywordId: KeywordId): TalentDefinition[][] {
  return chunkIntoRows(talentPoolByKeyword.get(keywordId) ?? [], TALENT_ROW_SIZES);
}

export function getAllocatableTalentChoices(keywordId: KeywordId, unlockedIds: string[]): TalentDefinition[] {
  const talents = talentPoolByKeyword.get(keywordId) ?? [];
  if (talents.length === 0) return [];
  const unlocked = new Set(unlockedIds);
  let start = 0;
  for (let row = 0; row <= TALENT_ROW_SIZES.length; row++) {
    const size = TALENT_ROW_SIZES[row] ?? talents.length;
    const end = Math.min(start + size, talents.length);
    let missing: TalentDefinition[] | undefined;
    for (let index = start; index < end; index++) {
      const talent = talents[index]!;
      if (!unlocked.has(talent.id)) (missing ??= []).push(talent);
    }
    if (missing) return missing;
    start = end;
  }
  return [];
}
