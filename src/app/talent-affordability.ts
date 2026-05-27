// Whether any talent keyword has unspent XP for the menu badge.
import { getTalentsForKeyword, keywordDefinitions, type KeywordId } from "@/lib/game-data";
import { getTalentKeywordProgress } from "@/lib/talents";
import type { TalentXP } from "@/lib/talents";
import type { UnlockedTalents } from "@/lib/game-data";

export function hasUnspentTalents(talentXP: TalentXP, unlockedTalents: UnlockedTalents): boolean {
  return Object.keys(keywordDefinitions).some((kw) => {
    const kwId = kw as KeywordId;
    const xp = talentXP[kwId] ?? 0;
    return getTalentKeywordProgress(xp, (unlockedTalents[kwId] ?? []).length, getTalentsForKeyword(kwId).length)
      .hasUnspent;
  });
}
