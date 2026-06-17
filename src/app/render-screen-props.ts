// Props for the screen route renderer (shared by render-alchemy-screen and screen-routes).
import type { BattleCard, CharacterId, DifficultyId, KeywordId, TrinketEntry } from "@/lib/game-data";
import type { GearInstance } from "@/lib/gear";
import type { MysteryChoice } from "@/lib/mystery";
import type { Destination, Screen } from "@/lib/routing";
import type { BattleControllerBindings } from "@/features/alchemy/shell/battle-bindings";

type ControllerActions = {
  navigation: {
    goToScreen: (screen: Screen) => void;
    goToOptions: () => void;
  };
  runStart: {
    beginCampaign: () => void;
    beginLabyrinth: () => void;
    beginWildwood: () => void;
    handleCharacterSelect: (id: CharacterId) => void;
    handleDraftComplete: (draftedCards: BattleCard[]) => void;
    handleDraftPick: (card: BattleCard) => void;
    handleDifficultySelect: (id: DifficultyId) => void;
    handleBackFromDifficultySelect: () => void;
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
    handleWildwoodRecoveryComplete: () => void;
    handleWildwoodRemoveCard: (index: number) => void;
    handleWildwoodSkipRemoval: () => void;
    handleShopContinue: () => void;
    handleShopBuyCard: (card: BattleCard, slotKey: string) => boolean;
    handleShopRemoveCard: (index: number) => void;
    handleShopRefresh: () => void;
    handleAlchemistBuyCard: (card: BattleCard, slotKey: string) => boolean;
    handleAlchemistContinue: () => void;
    handleAlchemistRefresh: () => void;
    handleAlchemistMixPotions: (a: number, b: number) => BattleCard | null;
    handleTrinketShopBuy: (trinket: TrinketEntry, slotKey: string) => boolean;
    handleTrinketShopRefresh: () => void;
    handleTrinketShopContinue: () => void;
    handleEquipmentShopBuy: (instance: GearInstance) => boolean;
    handleEquipmentShopRefresh: () => void;
    handleEquipmentShopContinue: () => void;
    getMerchantCardBuyPrice: (card: BattleCard) => number;
    getAlchemistPotionBuyPrice: (card: BattleCard) => number;
    getTrinketBuyPrice: (trinket: TrinketEntry) => number;
    getGearBuyPrice: (instance: GearInstance) => number;
    getShopRefreshPrice: (refreshesLeft: number) => number;
    getAlchemistRefreshPrice: (refreshesLeft: number) => number;
    getTrinketRefreshPrice: (refreshesLeft: number) => number;
    getEquipmentRefreshPrice: (refreshesLeft: number) => number;
    getRemoveCardPrice: () => number;
    getMixPotionPrice: () => number;
    handleMysteryChoice: (choice: MysteryChoice) => void;
    handleMysteryChooseCard: (cardId: string) => void;
    handleMysteryRemoveCard: (index: number) => void;
    handleMysteryContinue: () => void;
    handleCorruptCard: (index: number) => void;
    handleCorruptionExit: () => void;
    handleLabyrinthNodeEnter: (row: number, col: number) => void;
    handleLabyrinthEndRun: () => void;
    resetRunState: () => void;
    continueFromRunEnd: () => void;
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
  onBackFromOptions: () => void;
};
