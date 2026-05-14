// Memoized talent-pick sampling with an invalidation cache for re-rolls.
// Depends on game-data talent pool and XP constants. Used by talent tree screen.
import { useRef, useMemo } from "react";
import type { KeywordId } from "@/lib/game-data";
import { TALENT_CHOICES_OFFERED } from "@/lib/game-constants";
import { sampleTalentChoices, type TalentDefinition } from "@/lib/game-data";

export function useTalentChoices(
  selectedKeyword: KeywordId,
  unlockedIds: string[],
  hasUnspentPoints: boolean,
  allUnlocked: boolean,
) {
  const cacheRef = useRef<Record<string, TalentDefinition[]>>({});

  const currentChoices = useMemo(() => {
    const cached = cacheRef.current[selectedKeyword];
    if (cached) return cached;
    if (allUnlocked || !hasUnspentPoints) return null;
    const c = sampleTalentChoices(selectedKeyword, unlockedIds, TALENT_CHOICES_OFFERED);
    if (c.length > 0) cacheRef.current[selectedKeyword] = c;
    return c.length > 0 ? c : null;
  }, [selectedKeyword, unlockedIds, hasUnspentPoints, allUnlocked]);

  function invalidateKeyword(keyword: KeywordId) {
    delete cacheRef.current[keyword];
  }

  function invalidateAll() {
    cacheRef.current = {};
  }

  return { currentChoices, invalidateKeyword, invalidateAll };
}