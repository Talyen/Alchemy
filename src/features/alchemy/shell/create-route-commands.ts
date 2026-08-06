// Phased routeCommands assembly — feature command maps live here so the mega-controller stays thin wiring.
import type { BattleCard, CharacterId, DifficultyId, KeywordId } from "@/lib/game-data";
import type { Destination, Screen, BattleRefs } from "@/features/alchemy/shared/types";
import type { MysteryChoice } from "@/lib/mystery";
import type { ShopActions } from "@/features/alchemy/run-loop/shop/shop-action-types";
import type { MouseEvent } from "react";

export interface AlchemyRouteCommandDeps {
  goToScreen: (nextScreen: Screen) => void;
  beginCampaign: () => void;
  beginLabyrinth: () => void;
  beginWildwood: () => void;
  unlockTalent: (keywordId: KeywordId, talentId: string) => void;
  resetUnlockedTalents: () => void;
  handleCharacterSelect: (characterId: CharacterId) => void;
  handleDraftComplete: (draftedCards: BattleCard[]) => void;
  handleDraftPick: (card: BattleCard) => void;
  handleDifficultySelect: (difficultyId: DifficultyId) => void;
  handleBackFromDifficultySelect: () => void;
  handleLabyrinthNodeEnter: (row: number, col: number) => boolean;
  finishRewards: () => void;
  selectRewardChoice: (id: string) => void;
  prepareDestinationScreen: () => void;
  handleDestinationChoice: (destination: Destination) => void;
  handleCampfireContinue: () => void;
  handleWildwoodRecoveryComplete: () => void;
  handleWildwoodRemoveCard: (index: number) => void;
  handleWildwoodSkipRemoval: () => void;
  advanceToNextDestination: () => void;
  shop: ShopActions;
  handleMysteryChoice: (choice: MysteryChoice) => void;
  handleMysteryChooseCard: (cardId: string) => void;
  handleMysteryRemoveCard: (index: number) => void;
  handleMysteryContinue: () => void;
  handleCorruptCard: (cardIndex: number) => void;
  handleCorruptionExit: () => void;
  handleCardClick: (card: BattleCard, index: number, event: MouseEvent<HTMLButtonElement>) => void;
  handleWishChoice: (cardOrNull: BattleCard | null) => void;
  handleEndTurn: () => void;
  skipCombatDevMode: () => void;
  removeCardGhost: (id: string) => void;
  refs: BattleRefs;
  continueFromRunEnd: () => void;
}

function createMetaRouteCommands(
  deps: Pick<
    AlchemyRouteCommandDeps,
    "goToScreen" | "beginCampaign" | "beginLabyrinth" | "beginWildwood" | "unlockTalent" | "resetUnlockedTalents"
  >,
) {
  return {
    goToScreen: deps.goToScreen,
    beginCampaign: deps.beginCampaign,
    beginLabyrinth: deps.beginLabyrinth,
    beginWildwood: deps.beginWildwood,
    unlockTalent: deps.unlockTalent,
    resetUnlockedTalents: deps.resetUnlockedTalents,
  };
}

function createRunSetupRouteCommands(
  deps: Pick<
    AlchemyRouteCommandDeps,
    | "goToScreen"
    | "handleCharacterSelect"
    | "handleDraftComplete"
    | "handleDraftPick"
    | "handleDifficultySelect"
    | "handleBackFromDifficultySelect"
  >,
) {
  return {
    goToScreen: deps.goToScreen,
    handleCharacterSelect: deps.handleCharacterSelect,
    handleDraftComplete: deps.handleDraftComplete,
    handleDraftPick: deps.handleDraftPick,
    handleDifficultySelect: deps.handleDifficultySelect,
    handleBackFromDifficultySelect: deps.handleBackFromDifficultySelect,
  };
}

function createRunLoopRouteCommands(
  deps: Pick<
    AlchemyRouteCommandDeps,
    | "handleLabyrinthNodeEnter"
    | "finishRewards"
    | "selectRewardChoice"
    | "prepareDestinationScreen"
    | "handleDestinationChoice"
    | "handleCampfireContinue"
    | "handleWildwoodRecoveryComplete"
    | "handleWildwoodRemoveCard"
    | "handleWildwoodSkipRemoval"
    | "advanceToNextDestination"
    | "shop"
    | "handleMysteryChoice"
    | "handleMysteryChooseCard"
    | "handleMysteryRemoveCard"
    | "handleMysteryContinue"
    | "handleCorruptCard"
    | "handleCorruptionExit"
  >,
) {
  const { shop } = deps;
  return {
    labyrinth: {
      handleNodeEnter: deps.handleLabyrinthNodeEnter,
    },
    rewards: {
      finish: deps.finishRewards,
      selectChoice: deps.selectRewardChoice,
    },
    destinations: {
      prepare: deps.prepareDestinationScreen,
      choose: deps.handleDestinationChoice,
      continueCampfire: deps.handleCampfireContinue,
    },
    wildwood: {
      completeRecovery: deps.handleWildwoodRecoveryComplete,
      removeCard: deps.handleWildwoodRemoveCard,
      skipRemoval: deps.handleWildwoodSkipRemoval,
    },
    shop: {
      merchant: {
        handleBuyCard: shop.handleShopBuyCard,
        handleRemoveCard: shop.handleShopRemoveCard,
        handleRefresh: shop.handleShopRefresh,
        handleContinue: deps.advanceToNextDestination,
        getCardBuyPrice: shop.getMerchantCardBuyPrice,
        getRemoveCardPrice: shop.getRemoveCardPrice,
        getRefreshPrice: shop.getShopRefreshPrice,
      },
      alchemist: {
        handleBuyCard: shop.handleAlchemistBuyCard,
        handleRefresh: shop.handleAlchemistRefresh,
        handleMixPotions: shop.handleAlchemistMixPotions,
        handleContinue: deps.advanceToNextDestination,
        getPotionBuyPrice: shop.getAlchemistPotionBuyPrice,
        getMixPrice: shop.getMixPotionPrice,
        getRefreshPrice: shop.getAlchemistRefreshPrice,
      },
      trinket: {
        handleBuy: shop.handleTrinketShopBuy,
        handleRefresh: shop.handleTrinketShopRefresh,
        handleContinue: deps.advanceToNextDestination,
        getBuyPrice: shop.getTrinketBuyPrice,
        getRefreshPrice: shop.getTrinketRefreshPrice,
      },
      equipment: {
        handleBuy: shop.handleEquipmentShopBuy,
        handleRefresh: shop.handleEquipmentShopRefresh,
        handleContinue: deps.advanceToNextDestination,
        getBuyPrice: shop.getGearBuyPrice,
        getRefreshPrice: shop.getEquipmentRefreshPrice,
      },
    },
    mystery: {
      handleChoice: deps.handleMysteryChoice,
      handleChooseCard: deps.handleMysteryChooseCard,
      handleRemoveCard: deps.handleMysteryRemoveCard,
      handleContinue: deps.handleMysteryContinue,
    },
    corruption: {
      handleCorruptCard: deps.handleCorruptCard,
      handleExit: deps.handleCorruptionExit,
    },
  };
}

/** Assemble the phased routeCommands tree from shell controller surfaces. */
export function createAlchemyRouteCommands(deps: AlchemyRouteCommandDeps) {
  return {
    meta: createMetaRouteCommands(deps),
    runSetup: createRunSetupRouteCommands(deps),
    runLoop: createRunLoopRouteCommands(deps),
    battle: {
      handleCardClick: deps.handleCardClick,
      handleWishChoice: deps.handleWishChoice,
      handleEndTurn: deps.handleEndTurn,
      skipCombatDevMode: deps.skipCombatDevMode,
      removeCardGhost: deps.removeCardGhost,
      refs: deps.refs,
    },
    runEnd: {
      continueFromRunEnd: deps.continueFromRunEnd,
    },
  };
}

export type AlchemyRouteCommands = ReturnType<typeof createAlchemyRouteCommands>;
