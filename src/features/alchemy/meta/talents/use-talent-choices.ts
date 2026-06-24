import { useMemo } from "react";
import type { KeywordId, TalentXP } from "@/lib/game-data";
import { TALENT_CHOICES_OFFERED } from "@/lib/game-constants";
import { getNextTalentChoices, getTalentKeywordProgress, countImplementedTalents } from "@/lib/game-data";

export function useTalentChoices(selectedKeyword: KeywordId, talentXP: TalentXP, unlockedIds: string[]) {
  const implementedCount = countImplementedTalents(selectedKeyword);
  const progress = getTalentKeywordProgress(talentXP[selectedKeyword] ?? 0, unlockedIds.length, implementedCount);
  const hasUnspentPoints = progress.unspentPoints > 0;
  const allUnlocked = progress.spentPoints >= implementedCount;

  const currentChoices = useMemo(() => {
    if (allUnlocked || !hasUnspentPoints) {
      return null;
    }
    const c = getNextTalentChoices(selectedKeyword, unlockedIds, TALENT_CHOICES_OFFERED);
    return c.length > 0 ? c : null;
  }, [allUnlocked, hasUnspentPoints, selectedKeyword, unlockedIds]);

  return { currentChoices };
}
