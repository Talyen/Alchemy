import { useState } from "react";
import type { KeywordId } from "@/lib/game-data";
import { addTalentXP, extractCardKeywords, type TalentXP } from "@/lib/talents";
import { computeTalentEffects } from "./talent-pool";
import type { UnlockedTalents } from "./talent-pool";
import type { BattleCard } from "@/lib/game-data";
import type { TalentEffectManifest } from "@/lib/battle/types";

export function useTalentState(initialTalentXP: TalentXP, initialUnlockedTalents: UnlockedTalents) {
  const [talentXP, setTalentXP] = useState<TalentXP>(initialTalentXP);
  const [runTalentXP, setRunTalentXP] = useState<TalentXP>({});
  const [unlockedTalents, setUnlockedTalents] = useState<UnlockedTalents>(initialUnlockedTalents);

  function awardCardXP(card: BattleCard) {
    const keywords = extractCardKeywords(card);
    if (keywords.length === 0) return;
    setTalentXP((prev) => addTalentXP(prev, keywords));
    setRunTalentXP((prev) => addTalentXP(prev, keywords));
  }

  function unlockTalent(keywordId: KeywordId, talentId: string) {
    setUnlockedTalents((prev) => ({ ...prev, [keywordId]: [...(prev[keywordId] ?? []), talentId] }));
  }

  function resetUnlockedTalents() { setUnlockedTalents({}); }
  function resetRunXP() { setRunTalentXP({}); }
  function clearPermanentData() { setTalentXP({}); setRunTalentXP({}); setUnlockedTalents({}); }

  const talentEffects = computeTalentEffects(unlockedTalents);

  return {
    talentXP, runTalentXP, unlockedTalents, talentEffects,
    awardCardXP, unlockTalent, resetUnlockedTalents, resetRunXP, clearPermanentData,
  };
}
