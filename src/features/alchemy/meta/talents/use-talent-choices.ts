// Memoized next talent choices from current keyword progress (deterministic pool order).
// Depends on game-data talent pool and XP constants. Used by talent tree screen.
import { useMemo } from "react";
import type { KeywordId } from "@/lib/game-data";
import { TALENT_CHOICES_OFFERED } from "@/lib/game-constants";
import { getNextTalentChoices } from "@/lib/game-data";

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
    const c = getNextTalentChoices(selectedKeyword, unlockedIds, TALENT_CHOICES_OFFERED);
    return c.length > 0 ? c : null;
  }, [allUnlocked, hasUnspentPoints, selectedKeyword, unlockedIds]);

  return { currentChoices };
}
