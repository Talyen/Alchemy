import { vi } from "vitest";
import { battlePresentation } from "@/app/battle-presentation";
import type { AlchemyRouteCommands } from "@/features/alchemy/shell/route-commands";

export function createMockRouteCommands(): AlchemyRouteCommands {
  const fn = () => vi.fn();
  return {
    progress: { isPending: () => false, afterSaved: (feedback) => feedback() },
    meta: {
      resumeRun: vi.fn(),
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
      labyrinth: {
        handleNodeSelect: fn(),
        handleNodeDeselect: fn(),
        handleNodeEnter: fn(),
        descend: fn(),
      },
      rewards: { skip: fn(), claimChoice: fn() },
      destinations: { prepare: fn(), choose: fn(), continueCampfire: fn(), rest: fn(), brew: fn() },
      wildwood: { removeCard: fn(), skipRemoval: fn() },
      shop: {
        continue: fn(),
        merchant: {
          buyCard: fn(),
          removeCard: fn(),
          refresh: fn(),
          getCardBuyPrice: fn(),
          getRemoveCardPrice: fn(),
          getRefreshPrice: fn(),
        },
        alchemist: {
          buyPotion: fn(),
          refresh: fn(),
          mixPotions: fn(),
          strengthenPotion: fn(),
          getPotionBuyPrice: fn(),
          getMixPrice: fn(),
          getRefreshPrice: fn(),
        },
        trinket: {
          buy: fn(),
          refresh: fn(),
          getBuyPrice: fn(),
          getRefreshPrice: fn(),
        },
        equipment: {
          buy: fn(),
          refresh: fn(),
          getBuyPrice: fn(),
          getRefreshPrice: fn(),
        },
      },
      mystery: { handleChoice: fn(), handleChooseCard: fn(), handleContinue: fn() },
      corruption: { handleCorruptCard: fn(), handleExit: fn() },
      transmutation: { exchange: fn(), continue: fn() },
    },
    battle: {
      presentation: battlePresentation,
      screen: "battle",
      refs: {} as never,
      handleCardClick: fn(),
      handleWishChoice: fn(),
      handleEndTurn: fn(),
      handleAutoplayCard: fn(),
      handleAutoplayWish: fn(),
      skipCombatDevMode: fn(),
      bindPlayback: fn(),
      isCardPlayInProgress: vi.fn(() => false),
      isProgressSavePending: vi.fn(() => false),
      subscribeProgressSave: vi.fn(() => () => {}),
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
