import { useCallback, useLayoutEffect, useMemo } from "react";
import type { EncounterCombatTraitId, EncounterRewardTraitId } from "@/lib/content-systems/types";
import {
  unlockTalent,
  resetUnlockedTalents,
  setActiveLabyrinthModifiers,
  setActiveLabyrinthRewardModifiers,
  unlockAllTalents,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";
import { createShopActions } from "@/features/alchemy/run-loop/shop/create-shop-actions";
import { useRunFlowEngine } from "./use-run-flow-engine";
import { useLabyrinthController } from "./use-labyrinth-controller";
import { createLabyrinthNodeRouting } from "./labyrinth-node-routing";
import { useBattleWiring } from "./use-battle-wiring";
import { useLabyrinthEntryGuard } from "./use-labyrinth-entry-guard";
import { useScreenTransitions } from "./use-screen-transitions";
import { useSteamRichPresence } from "./use-steam-rich-presence";
import {
  useActiveRunCharacterId,
  useActiveRunScreenValue,
  useTalentEffects,
  useContentSystemType,
  useHomesteadEffects,
} from "@/features/alchemy/shared/stores/run-reads";
import { shouldSurrenderBattleOnEndRun } from "./end-run-policy";
import {
  createRunSessionCommand,
  dispatchRunSessionCommand,
} from "@/features/alchemy/shared/stores/run-session-command";

const commandUnlockTalent = createRunSessionCommand(unlockTalent);
const commandResetUnlockedTalents = createRunSessionCommand(resetUnlockedTalents);
const commandUnlockAllTalents = createRunSessionCommand(unlockAllTalents);

export function useAlchemyRunController() {
  const homesteadEffects = useHomesteadEffects();
  const talentEffects = useTalentEffects();
  const contentSystemType = useContentSystemType();
  const characterId = useActiveRunCharacterId();
  const screen = useActiveRunScreenValue();
  const { navigateTo, transition, commitPendingTransition, cancelPending } = useScreenTransitions(screen);

  const setHoveredCardId = useCallback((id: string | null | ((prev: string | null) => string | null)) => {
    const store = useUiStore.getState();
    store.setHoveredCardId(typeof id === "function" ? id(store.hoveredCardId) : id);
  }, []);
  const applyLabyrinthBattleModifiers = useCallback((modifiers: EncounterCombatTraitId[]) => {
    dispatchRunSessionCommand((draft) => setActiveLabyrinthModifiers(draft, modifiers));
  }, []);
  const applyLabyrinthRewardModifiers = useCallback((modifiers: EncounterRewardTraitId[]) => {
    dispatchRunSessionCommand((draft) => setActiveLabyrinthRewardModifiers(draft, modifiers));
  }, []);

  const { battle, setBattleCompletionHandlers } = useBattleWiring({
    screen,
    setHoveredCardId,
  });

  const shop = useMemo(() => createShopActions({ talentEffects, homesteadEffects }), [talentEffects, homesteadEffects]);

  const labyrinth = useLabyrinthController();

  const battleLauncher = useMemo(
    () => ({
      onStartBattle: battle.startBattle,
      onStartBossBattle: battle.startBossBattle,
      onStartBossById: battle.startBossById,
    }),
    [battle.startBattle, battle.startBossBattle, battle.startBossById],
  );

  const nav = useRunFlowEngine({
    screen,
    navigateTo,
    transition,
    cancelPending,
    battle: battleLauncher,
    initializeShop: shop.initialize,
    labyrinthClearNode: labyrinth.onNodeCleared,
  });

  useLayoutEffect(() => {
    setBattleCompletionHandlers({
      onBattleVictory: nav.handleBattleVictory,
      onBattleDefeat: nav.handleBattleDefeat,
    });
  }, [nav.handleBattleDefeat, nav.handleBattleVictory, setBattleCompletionHandlers]);

  useSteamRichPresence(screen, nav.runPhase, characterId);

  const beginLabyrinth = nav.beginLabyrinth;
  const activeRunData = nav.activeRunData;
  const hasActiveBattle = battle.hasActiveBattle;
  const handleBattleEndRun = battle.handleEndRun;
  const handleAbandonRun = nav.handleAbandonRun;

  const handleBeginLabyrinth = useLabyrinthEntryGuard({
    contentSystemType,
    activeRunData,
    hasActiveBattle,
    resetMap: labyrinth.resetMap,
    beginLabyrinth,
  });

  const nodeRouting = useMemo(
    () =>
      createLabyrinthNodeRouting({
        applyLabyrinthBattleModifiers,
        applyLabyrinthRewardModifiers,
        navigateTo,
        labyrinth,
        battle: {
          startBattle: battle.startBattle,
          startBossBattle: battle.startBossBattle,
        },
        nav: { beginMysteryEvent: nav.beginMysteryEvent },
        shop,
      }),
    [
      applyLabyrinthBattleModifiers,
      applyLabyrinthRewardModifiers,
      navigateTo,
      labyrinth,
      battle.startBattle,
      battle.startBossBattle,
      nav.beginMysteryEvent,
      shop,
    ],
  );

  const handleEndRun = useCallback(() => {
    if (shouldSurrenderBattleOnEndRun(screen, hasActiveBattle, contentSystemType)) {
      handleBattleEndRun();
      return;
    }
    handleAbandonRun();
  }, [screen, hasActiveBattle, handleBattleEndRun, contentSystemType, handleAbandonRun]);

  const routeCommands = useMemo(
    () => ({
      meta: {
        goToScreen: nav.goToScreen,
        beginCampaign: nav.beginCampaign,
        beginLabyrinth: handleBeginLabyrinth,
        beginWildwood: nav.beginWildwood,
        unlockTalent: commandUnlockTalent,
        resetUnlockedTalents: commandResetUnlockedTalents,
      },
      runSetup: {
        goToScreen: nav.goToScreen,
        handleCharacterSelect: nav.handleCharacterSelect,
        handleStandardDraftComplete: nav.handleStandardDraftComplete,
        handleWildwoodDraftComplete: nav.handleWildwoodDraftComplete,
        handleWildwoodDraftPick: nav.handleWildwoodDraftPick,
        handleStarterDraftPick: nav.handleStarterDraftPick,
        handleDifficultySelect: nav.handleDifficultySelect,
        handleBackFromDifficultySelect: nav.handleBackFromDifficultySelect,
      },
      runLoop: {
        labyrinth: {
          handleNodeSelect: labyrinth.selectNode,
          handleNodeDeselect: labyrinth.deselectNode,
          handleNodeEnter: nodeRouting.handleLabyrinthNodeEnter,
        },
        rewards: {
          finish: nav.finishRewards,
          selectChoice: nav.selectRewardChoice,
        },
        destinations: {
          prepare: nav.prepareDestinationScreen,
          choose: nav.handleDestinationChoice,
          continueCampfire: nav.handleCampfireContinue,
        },
        wildwood: {
          removeCard: nav.handleWildwoodRemoveCard,
          skipRemoval: nav.handleWildwoodSkipRemoval,
        },
        shop: {
          merchant: {
            handleBuyCard: shop.merchant.buyCard,
            handleRemoveCard: shop.merchant.removeCard,
            handleRefresh: shop.merchant.refresh,
            handleContinue: nav.advanceToNextDestination,
            getCardBuyPrice: shop.merchant.getCardBuyPrice,
            getRemoveCardPrice: shop.merchant.getRemoveCardPrice,
            getRefreshPrice: shop.merchant.getRefreshPrice,
          },
          alchemist: {
            handleBuyCard: shop.alchemist.buyPotion,
            handleRefresh: shop.alchemist.refresh,
            handleMixPotions: shop.alchemist.mixPotions,
            handleContinue: nav.advanceToNextDestination,
            getPotionBuyPrice: shop.alchemist.getPotionBuyPrice,
            getMixPrice: shop.alchemist.getMixPrice,
            getRefreshPrice: shop.alchemist.getRefreshPrice,
          },
          trinket: {
            handleBuy: shop.trinket.buy,
            handleRefresh: shop.trinket.refresh,
            handleContinue: nav.advanceToNextDestination,
            getBuyPrice: shop.trinket.getBuyPrice,
            getRefreshPrice: shop.trinket.getRefreshPrice,
          },
          equipment: {
            handleBuy: shop.equipment.buy,
            handleRefresh: shop.equipment.refresh,
            handleContinue: nav.advanceToNextDestination,
            getBuyPrice: shop.equipment.getBuyPrice,
            getRefreshPrice: shop.equipment.getRefreshPrice,
          },
        },
        mystery: {
          handleChoice: nav.handleMysteryChoice,
          handleChooseCard: nav.handleMysteryChooseCard,
          handleRemoveCard: nav.handleMysteryRemoveCard,
          handleContinue: nav.handleMysteryContinue,
        },
        corruption: {
          handleCorruptCard: nav.handleCorruptCard,
          handleExit: nav.handleCorruptionExit,
        },
      },
      battle: {
        handleCardClick: battle.handleCardClick,
        handleWishChoice: battle.handleWishChoice,
        handleEndTurn: battle.handleEndTurn,
        handleAutoplayCard: battle.handleAutoplayCard,
        skipCombatDevMode: battle.skipCombatDevMode,
        refs: battle.refs,
        bindPlayback: battle.bindPlayback,
        isCardPlayInProgress: battle.isCardPlayInProgress,
        screen: battle.screen,
        isAutoplayEnabled: battle.isAutoplayEnabled,
        setAutoplayEnabled: battle.setAutoplayEnabled,
        toggleAutoplayEnabled: battle.toggleAutoplayEnabled,
        boonInspectOpen: battle.boonInspectOpen,
        toggleBoonInspect: battle.toggleBoonInspect,
        closeBoonInspect: battle.closeBoonInspect,
      },
      runEnd: {
        continueFromRunEnd: nav.continueFromRunEnd,
      },
    }),
    [
      nav.goToScreen,
      nav.beginCampaign,
      nav.beginWildwood,
      nav.handleCharacterSelect,
      nav.handleStandardDraftComplete,
      nav.handleWildwoodDraftComplete,
      nav.handleWildwoodDraftPick,
      nav.handleStarterDraftPick,
      nav.handleDifficultySelect,
      nav.handleBackFromDifficultySelect,
      nav.finishRewards,
      nav.selectRewardChoice,
      nav.prepareDestinationScreen,
      nav.handleDestinationChoice,
      nav.handleCampfireContinue,
      nav.handleWildwoodRemoveCard,
      nav.handleWildwoodSkipRemoval,
      nav.advanceToNextDestination,
      nav.handleMysteryChoice,
      nav.handleMysteryChooseCard,
      nav.handleMysteryRemoveCard,
      nav.handleMysteryContinue,
      nav.handleCorruptCard,
      nav.handleCorruptionExit,
      nav.continueFromRunEnd,
      handleBeginLabyrinth,
      nodeRouting.handleLabyrinthNodeEnter,
      labyrinth.selectNode,
      labyrinth.deselectNode,
      shop.merchant.buyCard,
      shop.merchant.removeCard,
      shop.merchant.refresh,
      shop.merchant.getCardBuyPrice,
      shop.merchant.getRemoveCardPrice,
      shop.merchant.getRefreshPrice,
      shop.alchemist.buyPotion,
      shop.alchemist.refresh,
      shop.alchemist.mixPotions,
      shop.alchemist.getPotionBuyPrice,
      shop.alchemist.getMixPrice,
      shop.alchemist.getRefreshPrice,
      shop.trinket.buy,
      shop.trinket.refresh,
      shop.trinket.getBuyPrice,
      shop.trinket.getRefreshPrice,
      shop.equipment.buy,
      shop.equipment.refresh,
      shop.equipment.getBuyPrice,
      shop.equipment.getRefreshPrice,
      battle.handleCardClick,
      battle.handleWishChoice,
      battle.handleEndTurn,
      battle.handleAutoplayCard,
      battle.skipCombatDevMode,
      battle.refs,
      battle.bindPlayback,
      battle.isCardPlayInProgress,
      battle.screen,
      battle.isAutoplayEnabled,
      battle.setAutoplayEnabled,
      battle.toggleAutoplayEnabled,
      battle.boonInspectOpen,
      battle.toggleBoonInspect,
      battle.closeBoonInspect,
    ],
  );

  return {
    screen,
    homesteadEffects,
    commitPendingTransition,
    routeCommands,
    unlockAllTalents: commandUnlockAllTalents,
    returnToBattle: nav.returnToBattle,
    goToScreen: nav.goToScreen,
    handleEndRun,
    resetRunState: nav.resetRunState,
  };
}

type AlchemyRunController = ReturnType<typeof useAlchemyRunController>;
export type AlchemyRouteCommands = AlchemyRunController["routeCommands"];
export type AlchemyRunCommands = AlchemyRunController;
