// Memoized talent-pick sampling with an invalidation cache for re-rolls.
// Depends on game-data talent pool and XP constants. Used by talent tree screen.
import { useEffect, useRef, useState } from "react";
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
  const [currentChoices, setCurrentChoices] = useState<TalentDefinition[] | null>(null);

  useEffect(() => {
    if (allUnlocked || !hasUnspentPoints) {
      setCurrentChoices(null); // eslint-disable-line react-hooks/set-state-in-effect
      return;
    }
    const cached = cacheRef.current[selectedKeyword];
    if (cached) {
      setCurrentChoices(cached);
      return;
    }
    const c = sampleTalentChoices(selectedKeyword, unlockedIds, TALENT_CHOICES_OFFERED);
    if (c.length > 0) {
      cacheRef.current[selectedKeyword] = c;
      setCurrentChoices(c);
    } else {
      setCurrentChoices(null);
    }
  }, [selectedKeyword, unlockedIds, hasUnspentPoints, allUnlocked]);

  function invalidateKeyword(keyword: KeywordId) {
    delete cacheRef.current[keyword];
  }

  function invalidateAll() {
    cacheRef.current = {};
  }

  return { currentChoices, invalidateKeyword, invalidateAll };
}
