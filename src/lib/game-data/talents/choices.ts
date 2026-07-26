/**
 * Talent pool queries and deterministic next-choice ordering.
 */
import { keywordDefinitions } from "../keywords";
import type { KeywordId } from "../types";
import { talentPool } from "./pool";
import { isTalentPlaceholder, type TalentDefinition } from "./types";

/** Keywords shown in the talent tree and counted for unspent-point badges. */
export function getTalentTreeKeywordIds(): KeywordId[] {
  return (Object.keys(keywordDefinitions) as KeywordId[]).filter(
    (kw) => !keywordDefinitions[kw].hidden && countImplementedTalents(kw) > 0,
  );
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

/** Next unlockable talents in pool order (deterministic linear progression). */
export function getNextTalentChoices(
  keywordId: KeywordId,
  unlockedIds: string[],
  count: number = 1,
): TalentDefinition[] {
  return getImplementedTalentsForKeyword(keywordId)
    .filter((t) => !unlockedIds.includes(t.id))
    .slice(0, count);
}
