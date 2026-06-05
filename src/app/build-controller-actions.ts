// Maps run controller API to grouped screen renderer action surfaces.
import type { ControllerActions } from "@/app/controller-actions";
import type { useAlchemyRunController } from "@/features/alchemy/shell/use-alchemy-run-controller";

type RunController = ReturnType<typeof useAlchemyRunController>;

export function buildControllerActions(run: RunController): ControllerActions {
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
  };
}
