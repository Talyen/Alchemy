// Meta-progression actions for talents and collection-adjacent screens.
import type { KeywordId } from "@/lib/game-data";

export type MetaActions = {
  unlockTalent: (keywordId: KeywordId, talentId: string) => void;
  resetUnlockedTalents: () => void;
};
