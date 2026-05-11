// React state for permanent talent XP, run-scoped XP, unlocks, and derived effects.
// Depends on talent XP helpers, card keyword extraction, and talent-pool manifests.
// Used by battle/run controllers and talent UI.
import { useState } from "react";
import type { BattleCard, KeywordId } from "@/lib/game-data";
import { addTalentXP, extractCardKeywords, type TalentXP } from "@/lib/talents";
import { computeTalentEffects, talentPool } from "./talent-pool";
import type { UnlockedTalents } from "./talent-pool";

export function useTalentState(initialTalentXP: TalentXP, initialUnlockedTalents: UnlockedTalents) {
  // XP, run XP, unlocks, and derived effects are owned together so persistence, battle
  // setup, and the talent screen all observe a consistent progression snapshot.
  const [talentXP, setTalentXP] = useState<TalentXP>(initialTalentXP);
  const [runTalentXP, setRunTalentXP] = useState<TalentXP>({});
  const [unlockedTalents, setUnlockedTalents] = useState<UnlockedTalents>(initialUnlockedTalents);

  function awardCardXP(card: BattleCard) {
    // Cards can teach multiple keywords; XP is mirrored into permanent and run-scoped
    // stores so the run summary can show gains without delaying permanent progression.
    const keywords = extractCardKeywords(card);
    if (keywords.length === 0) return;
    setTalentXP((prev) => addTalentXP(prev, keywords));
    setRunTalentXP((prev) => addTalentXP(prev, keywords));
  }

  function awardMysteryXP(keywordId: KeywordId, amount: number) {
    setRunTalentXP((prev) => addTalentXP(prev, [keywordId], amount));
  }

  function unlockTalent(keywordId: KeywordId, talentId: string) {
    setUnlockedTalents((prev) => ({ ...prev, [keywordId]: [...(prev[keywordId] ?? []), talentId] }));
  }

  function unlockAllTalents() {
    // Debug/full-unlock replaces state grouped by keyword, matching the normal persisted
    // shape rather than appending duplicates into existing unlock arrays.
    const next: UnlockedTalents = {};
    for (const talent of talentPool) {
      next[talent.keywordId] = [...(next[talent.keywordId] ?? []), talent.id];
    }
    setUnlockedTalents(next);
  }

  function resetUnlockedTalents() { setUnlockedTalents({}); }
  function resetRunXP() { setRunTalentXP({}); }
  function clearPermanentData() { setTalentXP({}); setRunTalentXP({}); setUnlockedTalents({}); }

  const talentEffects = computeTalentEffects(unlockedTalents);

  return {
    talentXP, runTalentXP, unlockedTalents, talentEffects,
    awardCardXP, unlockTalent, unlockAllTalents, resetUnlockedTalents, resetRunXP, clearPermanentData,
    awardMysteryXP,
  };
}
