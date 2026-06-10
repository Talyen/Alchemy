// Whether any talent keyword has unspent XP for the menu badge.
import {
  countImplementedTalents,
  getTalentKeywordProgress,
  getTalentTreeKeywordIds,
  type UnlockedTalents,
  type TalentXP,
} from "@/lib/game-data";

export function hasUnspentTalents(talentXP: TalentXP, unlockedTalents: UnlockedTalents): boolean {
  return getTalentTreeKeywordIds().some((kwId) => {
    const xp = talentXP[kwId] ?? 0;
    return getTalentKeywordProgress(xp, (unlockedTalents[kwId] ?? []).length, countImplementedTalents(kwId)).hasUnspent;
  });
}
