import { keywordDefinitions } from "../keywords";
import type { KeywordId } from "../types";
import { getTalentsForKeyword, talentPoolByKeyword } from "./talent-pool-definitions";
import { TALENT_TREE_KEYWORD_IDS } from "./xp-keywords";
import type { TalentDefinition } from "./types";

export { getTalentsForKeyword } from "./talent-pool-definitions";

export const TALENT_ROW_SIZES = [1, 2, 3, 4] as const;

export function chunkIntoRows<T>(items: T[], sizes: readonly number[] | number): T[][] {
  if ((typeof sizes === "number" ? [sizes] : sizes).some((size) => !Number.isSafeInteger(size) || size <= 0)) {
    throw new RangeError("Row sizes must be positive safe integers");
  }
  const capacities = typeof sizes === "number" ? Array<number>(Math.ceil(items.length / sizes)).fill(sizes) : sizes;
  const rows: T[][] = [];
  let index = 0;
  for (const size of capacities) {
    rows.push(items.slice(index, index + size));
    index += size;
  }
  if (index < items.length) {
    rows.push(items.slice(index));
  }
  return rows;
}

const TALENT_TREE_KEYWORDS = (Object.keys(keywordDefinitions) as KeywordId[]).filter((kw) =>
  TALENT_TREE_KEYWORD_IDS.has(kw),
);

export function getTalentTreeKeywordIds(): KeywordId[] {
  return [...TALENT_TREE_KEYWORDS];
}

export function countImplementedTalents(keywordId: KeywordId): number {
  return talentPoolByKeyword.get(keywordId)?.length ?? 0;
}

export function getTalentRows(keywordId: KeywordId): TalentDefinition[][] {
  return chunkIntoRows(getTalentsForKeyword(keywordId), TALENT_ROW_SIZES);
}

export function getAllocatableTalentChoices(keywordId: KeywordId, unlockedIds: string[]): TalentDefinition[] {
  const unlocked = new Set(unlockedIds);
  const talents = talentPoolByKeyword.get(keywordId) ?? [];
  let start = 0;
  for (let row = 0; row <= TALENT_ROW_SIZES.length; row++) {
    const size = TALENT_ROW_SIZES[row] ?? talents.length;
    const end = Math.min(start + size, talents.length);
    const missing: TalentDefinition[] = [];
    for (let index = start; index < end; index++) {
      const talent = talents[index]!;
      if (!unlocked.has(talent.id)) missing.push(talent);
    }
    if (missing.length) return missing;
    start = end;
  }
  return [];
}
