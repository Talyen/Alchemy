// Memoized talent-pick sampling derived from current keyword progress.
// Depends on game-data talent pool and XP constants. Used by talent tree screen.
import { useMemo } from "react";
import type { KeywordId } from "@/lib/game-data";
import { TALENT_CHOICES_OFFERED } from "@/lib/game-constants";
import { sampleTalentChoices } from "@/lib/game-data";

export function useTalentChoices(
  selectedKeyword: KeywordId,
  unlockedIds: string[],
  hasUnspentPoints: boolean,
  allUnlocked: boolean,
) {
  const currentChoices = useMemo(() => {
    if (allUnlocked || !hasUnspentPoints) {
      return null;
    }
    const c = sampleTalentChoices(selectedKeyword, unlockedIds, TALENT_CHOICES_OFFERED);
    return c.length > 0 ? c : null;
  }, [allUnlocked, hasUnspentPoints, selectedKeyword, unlockedIds]);

  return { currentChoices };
}
