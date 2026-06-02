// Run start funnel actions from menu through draft/difficulty selection.
import type { BattleCard, CharacterId, DifficultyId } from "@/lib/game-data";

export type RunStartActions = {
  beginCampaign: () => void;
  beginLabyrinth: () => void;
  beginWildwood: () => void;
  handleCharacterSelect: (id: CharacterId) => void;
  handleDraftComplete: (draftedCards: BattleCard[]) => void;
  handleDifficultySelect: (id: DifficultyId) => void;
  handleBackFromDifficultySelect: () => void;
  handleWildwoodBossSelect: (id: string) => void;
};
