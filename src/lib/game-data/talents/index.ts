import type { KeywordId } from "../types";
import type { TalentDefinition } from "./types";
import { talentPool } from "./pool";

export * from "./types";
export * from "./progression";
export { talentPool } from "./pool";
export { DEFAULT_TALENT_EFFECTS } from "./manifest-defaults";
export { createEmptyTalentManifest, computeTalentEffects } from "./compute";

export function getTalentsForKeyword(keywordId: KeywordId): TalentDefinition[] {
  return talentPool.filter((t) => t.keywordId === keywordId);
}

export function sampleTalentChoices(
  keywordId: KeywordId,
  unlockedIds: string[],
  count: number = 1,
): TalentDefinition[] {
  return getTalentsForKeyword(keywordId)
    .filter((t) => !unlockedIds.includes(t.id))
    .slice(0, count);
}
