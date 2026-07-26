// Phase-scoped route contexts — keep the composer bag at App, narrow tables by phase.
import type { BattleControllerBindings } from "@/features/alchemy/shell/battle-bindings";
import type { AlchemyRunController } from "@/features/alchemy/shell/use-alchemy-run-controller";
import type { RenderAlchemyScreenProps } from "@/app/render-screen-props";

type Run = AlchemyRunController;

export interface MetaRouteCtx {
  run: Pick<
    Run,
    "goToScreen" | "beginCampaign" | "beginLabyrinth" | "beginWildwood" | "unlockTalent" | "resetUnlockedTalents"
  >;
  onOpenBattleMenu: RenderAlchemyScreenProps["onOpenBattleMenu"];
}

export interface RunSetupRouteCtx {
  run: Pick<
    Run,
    | "goToScreen"
    | "handleCharacterSelect"
    | "handleDifficultySelect"
    | "handleBackFromDifficultySelect"
    | "handleDraftComplete"
    | "handleDraftPick"
  >;
}

export interface RunLoopRouteCtx {
  run: Pick<
    Run,
    | "handleLabyrinthNodeEnter"
    | "finishRewards"
    | "selectRewardChoice"
    | "handleWildwoodRecoveryComplete"
    | "handleWildwoodRemoveCard"
    | "handleWildwoodSkipRemoval"
    | "prepareDestinationScreen"
    | "handleDestinationChoice"
    | "handleCampfireContinue"
    | "handleShopBuyCard"
    | "handleShopRemoveCard"
    | "handleShopRefresh"
    | "handleShopContinue"
    | "handleAlchemistBuyCard"
    | "handleAlchemistRefresh"
    | "handleAlchemistMixPotions"
    | "handleAlchemistContinue"
    | "handleTrinketShopBuy"
    | "handleTrinketShopRefresh"
    | "handleTrinketShopContinue"
    | "handleEquipmentShopBuy"
    | "handleEquipmentShopRefresh"
    | "handleEquipmentShopContinue"
    | "getMerchantCardBuyPrice"
    | "getAlchemistPotionBuyPrice"
    | "getTrinketBuyPrice"
    | "getGearBuyPrice"
    | "getShopRefreshPrice"
    | "getAlchemistRefreshPrice"
    | "getTrinketRefreshPrice"
    | "getEquipmentRefreshPrice"
    | "getRemoveCardPrice"
    | "getMixPotionPrice"
    | "handleMysteryChoice"
    | "handleMysteryChooseCard"
    | "handleMysteryRemoveCard"
    | "handleMysteryContinue"
    | "handleCorruptCard"
    | "handleCorruptionExit"
  >;
  onOpenBattleMenu: RenderAlchemyScreenProps["onOpenBattleMenu"];
}

export interface BattleRouteCtx {
  run: Pick<Run, "handleCardClick" | "handleWishChoice" | "removeCardGhost" | "skipCombatDevMode" | "handleEndTurn">;
  battleBindings: BattleControllerBindings;
  onOpenBattleMenu: RenderAlchemyScreenProps["onOpenBattleMenu"];
}

export interface RunEndRouteCtx {
  run: Pick<Run, "continueFromRunEnd">;
}

export type OptionsRouteCtx = Pick<
  RenderAlchemyScreenProps,
  "onOpenBattleMenu" | "onClearSaveData" | "onUnlockAllDevMode" | "onBackFromOptions"
>;
