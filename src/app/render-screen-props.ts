// Props for the screen route renderer (shared by render-alchemy-screen and screen-routes).
import type { BattleCard, CharacterId, DifficultyId, KeywordId } from "@/lib/game-data";
import type { MysteryChoice } from "@/lib/mystery";
import type { Destination, Screen } from "@/lib/routing";
import type { BattleControllerBindings } from "@/features/alchemy/shell/battle-bindings";

type ControllerActions = {
  navigation: {
    goToScreen: (screen: Screen) => void;
  };
  runStart: {
    beginCampaign: () => void;
    beginLabyrinth: () => void;
    beginWildwood: () => void;
    handleCharacterSelect: (id: CharacterId) => void;
    handleDraftComplete: (draftedCards: BattleCard[]) => void;
    handleDifficultySelect: (id: DifficultyId) => void;
    handleBackFromDifficultySelect: () => void;
    handleWildwoodBossSelect: (id: string) => void;
  };
  battle: {
    handleCardClick: (card: BattleCard, index: number, event: React.MouseEvent<HTMLButtonElement>) => void;
    handleWishChoice: (card: BattleCard | null) => void;
    handleEndTurn: () => void;
    handleEndRun: () => void;
    skipCombatDevMode: () => void;
    removeCardGhost: (id: string) => void;
    returnToBattle: () => void;
  };
  runFlow: {
    finishRewards: () => void;
    selectRewardChoice: (id: string) => void;
    prepareDestinationScreen: () => void;
    handleDestinationChoice: (dest: Destination) => void;
    handleCampfireContinue: () => void;
    handleShopContinue: () => void;
    handleShopBuyCard: (card: BattleCard) => void | null;
    handleShopRemoveCard: (index: number) => void;
    handleShopRefresh: () => void;
    handleAlchemistBuyCard: (card: BattleCard) => void | null;
    handleAlchemistContinue: () => void;
    handleAlchemistRefresh: () => void;
    handleAlchemistMixPotions: (a: number, b: number) => BattleCard | null;
    handleMysteryChoice: (choice: MysteryChoice) => void;
    handleMysteryChooseCard: (cardId: string) => void;
    handleMysteryRemoveCard: (index: number) => void;
    handleMysteryContinue: () => void;
    handleCorruptCard: (index: number) => void;
    handleCorruptionExit: () => void;
    handleLabyrinthNodeEnter: (row: number, col: number) => void;
    handleLabyrinthEndRun: () => void;
    resetRunState: () => void;
  };
  meta: {
    unlockTalent: (keywordId: KeywordId, talentId: string) => void;
    resetUnlockedTalents: () => void;
  };
};

export type RenderAlchemyScreenProps = {
  screen: Screen;
  actions: ControllerActions;
  battleBindings: BattleControllerBindings;
  onOpenBattleMenu: (rect?: DOMRect) => void;
  onClearSaveData: () => void;
  onUnlockAllDevMode: () => void;
};
