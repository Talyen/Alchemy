// Type-only file — the hook implementation moved to stores/run-store.ts.
import type { BattleCard, KeywordId, UnlockedTalents } from "@/lib/game-data";
import type { TalentXP } from "@/lib/talents";
import type { TalentEffectManifest } from "@/lib/game-data";

export type TalentStateController = {
  talentXP: TalentXP;
  runTalentXP: TalentXP;
  unlockedTalents: UnlockedTalents;
  talentEffects: TalentEffectManifest;
  awardCardXP: (card: BattleCard) => void;
  unlockTalent: (keywordId: KeywordId, talentId: string) => void;
  unlockAllTalents: () => void;
  resetUnlockedTalents: () => void;
  resetRunXP: () => void;
  clearPermanentData: () => void;
  awardMysteryXP: (keywordId: KeywordId, amount: number) => void;
};
