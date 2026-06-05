// Maps run controller API to grouped screen renderer action surfaces.
import type { BattleCard, CharacterId, DifficultyId, KeywordId } from "@/lib/game-data";
import type { MysteryChoice } from "@/lib/mystery";
import type { Destination, Screen } from "@/lib/routing";
import type { useAlchemyRunController } from "@/features/alchemy/shell/use-alchemy-run-controller";

type RunController = ReturnType<typeof useAlchemyRunController>;

export type ControllerActions = ReturnType<typeof buildControllerActions>;

export function buildControllerActions(run: RunController) {
  return {
    navigation: {
      goToScreen: run.goToScreen,
      navigateTo: run.goToScreen,
    },
    runStart: {
      beginCampaign: run.beginCampaign,
      beginLabyrinth: run.beginLabyrinth,
      beginWildwood: run.beginWildwood,
      handleCharacterSelect: run.handleCharacterSelect,
      handleDraftComplete: run.handleDraftComplete,
      handleDifficultySelect: run.handleDifficultySelect,
      handleBackFromDifficultySelect: run.handleBackFromDifficultySelect,
      handleWildwoodBossSelect: run.handleWildwoodBossSelect,
    },
    battle: {
      handleCardClick: run.handleCardClick,
      handleWishChoice: run.handleWishChoice,
      handleEndTurn: run.handleEndTurn,
      handleEndRun: run.handleEndRun,
      skipCombatDevMode: run.skipCombatDevMode,
      removeCardGhost: run.removeCardGhost,
      returnToBattle: run.returnToBattle,
    },
    runFlow: {
      finishRewards: run.finishRewards,
      selectRewardChoice: run.selectRewardChoice,
      prepareDestinationScreen: run.prepareDestinationScreen,
      handleDestinationChoice: run.handleDestinationChoice,
      handleCampfireContinue: run.handleCampfireContinue,
      handleShopContinue: run.handleShopContinue,
      handleShopBuyCard: run.handleShopBuyCard,
      handleShopRemoveCard: run.handleShopRemoveCard,
      handleShopRefresh: run.handleShopRefresh,
      handleAlchemistContinue: run.handleAlchemistContinue,
      handleAlchemistBuyCard: run.handleAlchemistBuyCard,
      handleAlchemistRefresh: run.handleAlchemistRefresh,
      handleAlchemistMixPotions: run.handleAlchemistMixPotions,
      handleMysteryChoice: run.handleMysteryChoice,
      handleMysteryChooseCard: run.handleMysteryChooseCard,
      handleMysteryRemoveCard: run.handleMysteryRemoveCard,
      handleMysteryContinue: run.handleMysteryContinue,
      handleCorruptCard: run.handleCorruptCard,
      handleCorruptionExit: run.handleCorruptionExit,
      handleLabyrinthNodeEnter: run.handleLabyrinthNodeEnter,
      handleLabyrinthEndRun: run.handleLabyrinthEndRun,
      resetRunState: run.resetRunState,
    },
    meta: {
      unlockTalent: run.unlockTalent,
      resetUnlockedTalents: run.resetUnlockedTalents,
    },
  } satisfies {
    navigation: {
      navigateTo: (screen: Screen) => void;
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
}
