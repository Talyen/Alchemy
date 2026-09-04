import { vi } from "vitest";
import type { AlchemyRouteCommands } from "@/features/alchemy/shell/use-alchemy-run-controller";

export function createMockRouteCommands(): AlchemyRouteCommands {
  const fn = () => vi.fn();
  return {
    meta: {
      goToScreen: fn(),
      beginCampaign: fn(),
      beginLabyrinth: fn(),
      beginWildwood: fn(),
      unlockTalent: fn(),
      resetUnlockedTalents: fn(),
    },
    runSetup: {
      goToScreen: fn(),
      handleCharacterSelect: fn(),
      handleStandardDraftComplete: fn(),
      handleWildwoodDraftComplete: fn(),
      handleWildwoodDraftPick: fn(),
      handleStarterDraftPick: fn(),
      handleDifficultySelect: fn(),
      handleBackFromDifficultySelect: fn(),
    },
    runLoop: {
      labyrinth: { handleNodeSelect: fn(), handleNodeDeselect: fn(), handleNodeEnter: fn() },
      rewards: { finish: fn(), selectChoice: fn() },
      destinations: { prepare: fn(), choose: fn(), continueCampfire: fn() },
      wildwood: { removeCard: fn(), skipRemoval: fn() },
      shop: {
        merchant: {
          handleBuyCard: fn(),
          handleRemoveCard: fn(),
          handleRefresh: fn(),
          handleContinue: fn(),
          getCardBuyPrice: fn(),
          getRemoveCardPrice: fn(),
          getRefreshPrice: fn(),
        },
        alchemist: {
          handleBuyCard: fn(),
          handleRefresh: fn(),
          handleMixPotions: fn(),
          handleContinue: fn(),
          getPotionBuyPrice: fn(),
          getMixPrice: fn(),
          getRefreshPrice: fn(),
        },
        trinket: {
          handleBuy: fn(),
          handleRefresh: fn(),
          handleContinue: fn(),
          getBuyPrice: fn(),
          getRefreshPrice: fn(),
        },
        equipment: {
          handleBuy: fn(),
          handleRefresh: fn(),
          handleContinue: fn(),
          getBuyPrice: fn(),
          getRefreshPrice: fn(),
        },
      },
      mystery: { handleChoice: fn(), handleChooseCard: fn(), handleRemoveCard: fn(), handleContinue: fn() },
      corruption: { handleCorruptCard: fn(), handleExit: fn() },
    },
    battle: {
      screen: "battle",
      refs: {} as never,
      handleCardClick: fn(),
      handleWishChoice: fn(),
      handleEndTurn: fn(),
      handleAutoplayCard: fn(),
      skipCombatDevMode: fn(),
      bindPlayback: fn(),
      isCardPlayInProgress: vi.fn(() => false),
      isAutoplayEnabled: false,
      setAutoplayEnabled: fn(),
      toggleAutoplayEnabled: fn(),
      boonInspectOpen: false,
      toggleBoonInspect: fn(),
      closeBoonInspect: fn(),
    },
    runEnd: { continueFromRunEnd: fn() },
  };
}
