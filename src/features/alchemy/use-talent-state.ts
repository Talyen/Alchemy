// React state for permanent talent XP, run-scoped XP, unlocks, and derived effects.
// Depends on talent XP helpers, card keyword extraction, and talent-pool manifests.
// Used by battle/run controllers and talent UI.
import { useState } from "react";
import type { BattleCard, KeywordId } from "@/lib/game-data";
import { addTalentXP, extractCardKeywords, type TalentXP } from "@/lib/talents";
import { computeTalentEffects, talentPool, type UnlockedTalents } from "@/lib/game-data";

export function useTalentState(initialTalentXP: TalentXP, initialUnlockedTalents: UnlockedTalents) {
  // XP, run XP, and unlocks are owned by one store so progression mutations stay grouped.
  const [state, setState] = useState({ talentXP: initialTalentXP, runTalentXP: {} as TalentXP, unlockedTalents: initialUnlockedTalents });

  function awardCardXP(card: BattleCard) {
    // Cards can teach multiple keywords; XP is mirrored into permanent and run-scoped
    // stores so the run summary can show gains without delaying permanent progression.
    const keywords = extractCardKeywords(card);
    if (keywords.length === 0) return;
    setState((prev) => ({ ...prev, talentXP: addTalentXP(prev.talentXP, keywords), runTalentXP: addTalentXP(prev.runTalentXP, keywords) }));
  }

  function awardMysteryXP(keywordId: KeywordId, amount: number) {
    setState((prev) => ({ ...prev, runTalentXP: addTalentXP(prev.runTalentXP, [keywordId], amount) }));
  }

  function unlockTalent(keywordId: KeywordId, talentId: string) {
    setState((prev) => ({ ...prev, unlockedTalents: { ...prev.unlockedTalents, [keywordId]: [...(prev.unlockedTalents[keywordId] ?? []), talentId] } }));
  }

  function unlockAllTalents() {
    // Debug/full-unlock replaces state grouped by keyword, matching the normal persisted
    // shape rather than appending duplicates into existing unlock arrays.
    const next: UnlockedTalents = {};
    for (const talent of talentPool) {
      next[talent.keywordId] = [...(next[talent.keywordId] ?? []), talent.id];
    }
    setState((prev) => ({ ...prev, unlockedTalents: next }));
  }

  function resetUnlockedTalents() { setState((prev) => ({ ...prev, unlockedTalents: {} })); }
  function resetRunXP() { setState((prev) => ({ ...prev, runTalentXP: {} })); }
  function clearPermanentData() { setState({ talentXP: {}, runTalentXP: {}, unlockedTalents: {} }); }

  const talentEffects = computeTalentEffects(state.unlockedTalents);

  return {
    talentXP: state.talentXP, runTalentXP: state.runTalentXP, unlockedTalents: state.unlockedTalents, talentEffects,
    awardCardXP, unlockTalent, unlockAllTalents, resetUnlockedTalents, resetRunXP, clearPermanentData,
    awardMysteryXP,
  };
}
