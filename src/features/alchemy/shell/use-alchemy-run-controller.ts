// Top-level alchemy controller composition hook.
// Depends on run, battle, shop, navigation, talent, persistence-facing, and homestead state.
// Used by App as the single UI-facing API while domain rules stay in smaller controllers.
import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import type { BattleControllerBindings } from "./battle-bindings";
import type { CharacterId, DifficultyId, UnlockedTalents, TalentXP } from "@/lib/game-data";
import type { LabyrinthModifierKind } from "@/lib/content-systems/types";
import {
  useRunAdapter,
  useTalentAdapter,
  useHomesteadAdapter,
  createRunRandomSource,
} from "@/features/alchemy/shared/stores/run-session-facade";
import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";
import {
  setActiveLabyrinthModifiers,
  setActiveLabyrinthRewardModifiers,
} from "@/features/alchemy/shared/stores/run-session-facade";
import { useBattleController } from "./use-battle-controller";
import { useShopController } from "./use-shop-controller";
import { useRunNavigation } from "./use-run-navigation";
import { useLabyrinthController } from "./use-labyrinth-controller";
import { createLabyrinthNodeRouting } from "./labyrinth-node-routing";
import { useScreenTransitions } from "./use-screen-transitions";
import { useSteamRichPresence } from "./use-steam-rich-presence";
import { restoreRun, useActiveRunScreen } from "@/features/alchemy/shared/stores/run-session-facade";
import { readActiveRunStore } from "@/features/alchemy/shared/stores/run-session-facade";
import type { ActiveRunData } from "@/lib/active-run-session";
import { shouldSurrenderBattleOnEndRun } from "./end-run-policy";

export function useAlchemyRunController({
  initialTalentXP,
  initialUnlockedTalents,
  initialActiveRun,
  autoEndTurn,
  onMarkDifficultyCompleted,
}: {
  initialTalentXP: TalentXP;
  initialUnlockedTalents: UnlockedTalents;
  initialActiveRun: ActiveRunData | null;
  autoEndTurn: boolean;
  onMarkDifficultyCompleted: (characterId: CharacterId, difficultyId: DifficultyId) => void;
}) {
  useLayoutEffect(() => {
    if (readActiveRunStore().initialized) return;
    restoreRun(initialActiveRun, initialTalentXP, initialUnlockedTalents);
  }, [initialActiveRun, initialTalentXP, initialUnlockedTalents]);
  const run = useRunAdapter();
  const talents = useTalentAdapter();
  const homesteadEffects = useHomesteadAdapter();
  const runRandom = useMemo(
    () => ({
      rewards: createRunRandomSource("rewards"),
      destinations: createRunRandomSource("destinations"),
      events: createRunRandomSource("events"),
      shops: createRunRandomSource("shops"),
      world: createRunRandomSource("world"),
    }),
    [],
  );

  const { screen, setScreen } = useActiveRunScreen();
  const { navigateTo, transition, commitPendingTransition, cancelPending } = useScreenTransitions(screen, setScreen);

  // ============ Store-backed Setters ============
  const setHoveredCardId = useCallback((id: string | null | ((prev: string | null) => string | null)) => {
    const store = useUiStore.getState();
    store.setHoveredCardId(typeof id === "function" ? id(store.hoveredCardId) : id);
  }, []);
  const applyLabyrinthBattleModifiers = useCallback((modifiers: LabyrinthModifierKind[]) => {
    setActiveLabyrinthModifiers(modifiers);
  }, []);
  const applyLabyrinthRewardModifiers = useCallback((modifiers: LabyrinthModifierKind[]) => {
    setActiveLabyrinthRewardModifiers(modifiers);
  }, []);

  // ============ Domain Controllers ============
  const onBattleVictoryRef = useRef<() => void>(() => {});
  const onBattleDefeatRef = useRef<() => void>(() => {});

  // Refs updated synchronously during render so the latest callbacks are always available
  // for the next user interaction.  Defined before battle because battle depends on these refs.

  const battle = useBattleController({
    run,
    talents,
    autoEndTurn,
    homesteadEffects,
    screen,
    setHoveredCardId,
    onBattleVictory: () => onBattleVictoryRef.current(),
    onBattleDefeat: () => onBattleDefeatRef.current(),
    rng: runRandom.world,
  });

  const shop = useShopController({ run, talents, homesteadEffects, rng: runRandom.shops });

  const labyrinth = useLabyrinthController(screen, runRandom.world);

  const nav = useRunNavigation({
    screen,
    navigateTo,
    transition,
    cancelPending,
    onStartBattle: battle.startBattle,
    onStartBossBattle: battle.startBossBattle,
    onStartBossById: battle.startBossById,
    onLabyrinthClearNode: labyrinth.onNodeCleared,
    onLabyrinthFailNode: labyrinth.onNodeFailed,
    onInitShop: shop.initShop,
    onInitAlchemist: shop.initAlchemist,
    onInitTrinketShop: shop.initTrinketShop,
    onInitEquipmentShop: shop.initEquipmentShop,
    onMarkDifficultyCompleted,
    randomSources: runRandom,
  });

  // useLayoutEffect ensures refs are current before the browser paints, so
  // battle callbacks triggered by user interaction always see the latest nav state.
  useLayoutEffect(() => {
    onBattleVictoryRef.current = nav.handleBattleVictory;
    onBattleDefeatRef.current = nav.handleBattleDefeat;
  });

  useSteamRichPresence(screen, nav.runPhase, run.characterId);

  function handleBeginLabyrinth() {
    if (
      !(nav.activeRunData && run.contentSystemType === "labyrinth") &&
      !(battle.hasActiveBattle && run.contentSystemType === "labyrinth")
    ) {
      labyrinth.resetMap();
    }
    nav.beginLabyrinth();
  }

  const nodeRouting = useMemo(
    () =>
      createLabyrinthNodeRouting({
        applyLabyrinthBattleModifiers,
        applyLabyrinthRewardModifiers,
        navigateTo,
        labyrinth,
        battle,
        nav,
        shop,
      }),
    [applyLabyrinthBattleModifiers, applyLabyrinthRewardModifiers, navigateTo, labyrinth, battle, nav, shop],
  );
  const { handleLabyrinthNodeEnter } = nodeRouting;

  function handleEndRun() {
    if (shouldSurrenderBattleOnEndRun(screen, battle.hasActiveBattle, run.contentSystemType)) {
      battle.handleEndRun();
      return;
    }
    nav.handleAbandonRun();
  }

  const routeCommands = {
    meta: {
      goToScreen: nav.goToScreen,
      beginCampaign: nav.beginCampaign,
      beginLabyrinth: handleBeginLabyrinth,
      beginWildwood: nav.beginWildwood,
      unlockTalent: talents.unlockTalent,
      resetUnlockedTalents: talents.resetUnlockedTalents,
    },
    runSetup: {
      goToScreen: nav.goToScreen,
      handleCharacterSelect: nav.handleCharacterSelect,
      handleDraftComplete: nav.handleDraftComplete,
      handleDraftPick: nav.handleDraftPick,
      handleDifficultySelect: nav.handleDifficultySelect,
      handleBackFromDifficultySelect: nav.handleBackFromDifficultySelect,
    },
    runLoop: {
      handleLabyrinthNodeEnter,
      finishRewards: nav.finishRewards,
      selectRewardChoice: nav.selectRewardChoice,
      prepareDestinationScreen: nav.prepareDestinationScreen,
      handleDestinationChoice: nav.handleDestinationChoice,
      handleCampfireContinue: nav.handleCampfireContinue,
      handleWildwoodRecoveryComplete: nav.handleWildwoodRecoveryComplete,
      handleWildwoodRemoveCard: nav.handleWildwoodRemoveCard,
      handleWildwoodSkipRemoval: nav.handleWildwoodSkipRemoval,
      handleShopBuyCard: shop.handleShopBuyCard,
      handleShopRemoveCard: shop.handleShopRemoveCard,
      handleShopRefresh: shop.handleShopRefresh,
      handleShopContinue: nav.advanceToNextDestination,
      handleAlchemistBuyCard: shop.handleAlchemistBuyCard,
      handleAlchemistRefresh: shop.handleAlchemistRefresh,
      handleAlchemistMixPotions: shop.handleAlchemistMixPotions,
      handleAlchemistContinue: nav.advanceToNextDestination,
      handleTrinketShopBuy: shop.handleTrinketShopBuy,
      handleTrinketShopRefresh: shop.handleTrinketShopRefresh,
      handleTrinketShopContinue: nav.advanceToNextDestination,
      handleEquipmentShopBuy: shop.handleEquipmentShopBuy,
      handleEquipmentShopRefresh: shop.handleEquipmentShopRefresh,
      handleEquipmentShopContinue: nav.advanceToNextDestination,
      getMerchantCardBuyPrice: shop.getMerchantCardBuyPrice,
      getAlchemistPotionBuyPrice: shop.getAlchemistPotionBuyPrice,
      getTrinketBuyPrice: shop.getTrinketBuyPrice,
      getGearBuyPrice: shop.getGearBuyPrice,
      getShopRefreshPrice: shop.getShopRefreshPrice,
      getAlchemistRefreshPrice: shop.getAlchemistRefreshPrice,
      getTrinketRefreshPrice: shop.getTrinketRefreshPrice,
      getEquipmentRefreshPrice: shop.getEquipmentRefreshPrice,
      getRemoveCardPrice: shop.getRemoveCardPrice,
      getMixPotionPrice: shop.getMixPotionPrice,
      handleMysteryChoice: nav.handleMysteryChoice,
      handleMysteryChooseCard: nav.handleMysteryChooseCard,
      handleMysteryRemoveCard: nav.handleMysteryRemoveCard,
      handleMysteryContinue: nav.handleMysteryContinue,
      handleCorruptCard: nav.handleCorruptCard,
      handleCorruptionExit: nav.handleCorruptionExit,
    },
    battle: {
      handleCardClick: battle.handleCardClick,
      handleWishChoice: battle.handleWishChoice,
      handleEndTurn: battle.handleEndTurn,
      skipCombatDevMode: battle.skipCombatDevMode,
      removeCardGhost: battle.removeCardGhost,
    },
    runEnd: {
      continueFromRunEnd: nav.continueFromRunEnd,
    },
  };

  const battleBindings = useMemo<BattleControllerBindings>(
    () => ({
      battleScreenData: battle.battleScreenData,
      handCardRefs: battle.handCardRefs,
      drawPileRef: battle.drawPileRef,
      discardPileRef: battle.discardPileRef,
      battleSceneRef: battle.battleSceneRef,
      playerPanelRef: battle.playerPanelRef,
      enemyPanelRef: battle.enemyPanelRef,
      cardTransfers: battle.cardTransfers,
      hiddenHandCardKeys: battle.hiddenHandCardKeys,
      cardTransferInProgress: battle.cardTransferInProgress,
      playableHandCardKeys: battle.playableHandCardKeys,
    }),
    [
      battle.battleScreenData,
      battle.cardTransfers,
      battle.hiddenHandCardKeys,
      battle.cardTransferInProgress,
      battle.playableHandCardKeys,
      battle.handCardRefs,
      battle.drawPileRef,
      battle.discardPileRef,
      battle.battleSceneRef,
      battle.playerPanelRef,
      battle.enemyPanelRef,
    ],
  );

  return {
    screen,
    runPhase: nav.runPhase,
    commitPendingTransition,
    routeCommands,
    battleBindings,
    battleState: battle.battleState,
    hasActiveBattle: battle.hasActiveBattle,
    characterId: run.characterId,
    contentSystemType: run.contentSystemType,
    talentXP: talents.talentXP,
    unlockedTalents: talents.unlockedTalents,
    unlockAllTalents: talents.unlockAllTalents,
    rewardState: nav.rewardState,
    get shopCards() {
      return shop.shopCards;
    },
    get alchemistPotions() {
      return shop.alchemistPotions;
    },
    get mysteryEvent() {
      return nav.mysteryEvent;
    },
    get activeRunData() {
      return nav.activeRunData;
    },
    returnToBattle: nav.returnToBattle,
    goToScreen: nav.goToScreen,
    handleEndRun,
    resetRunState: nav.resetRunState,
  };
}

type AlchemyRunController = ReturnType<typeof useAlchemyRunController>;
export type AlchemyRouteCommands = AlchemyRunController["routeCommands"];
