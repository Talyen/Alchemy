import { createRunOutcomes } from "@/features/alchemy/run-loop/run/run-flow";
import { createShopActions } from "@/features/alchemy/run-loop/shop/create-shop-actions";
import {
  useActiveRunCharacterId,
  useActiveRunScreenValue,
  useContentSystemType,
  useHomesteadEffects,
  useTalentEffects,
} from "@/features/alchemy/shared/stores/run-reads";
import {
  createRunSessionCommand,
  dispatchRunSessionCommand,
} from "@/features/alchemy/shared/stores/run-session-command";
import {
  resetUnlockedTalents,
  setActiveLabyrinthModifiers,
  setActiveLabyrinthRewardModifiers,
  setCorruptionResult,
  unlockAllTalents,
  unlockTalent,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";
import type { EncounterCombatTraitId, EncounterRewardTraitId } from "@/lib/content-systems/types";
import { useCallback, useMemo } from "react";
import { shouldSurrenderBattleOnEndRun } from "./end-run-policy";
import { createLabyrinthNodeRouting } from "./labyrinth-node-routing";
import { getRunAvailableDestinations } from "./run-destination-wiring";
import { useBattleController } from "./use-battle-controller";
import { createLabyrinthController } from "@/features/alchemy/run-loop/run/labyrinth-controller";
import { useRunFlowEngine } from "./use-run-flow-engine";
import { useScreenTransitions } from "./use-screen-transitions";
import { useSteamRichPresence } from "./use-steam-rich-presence";

const commandUnlockTalent = createRunSessionCommand(unlockTalent);
const commandResetUnlockedTalents = createRunSessionCommand(resetUnlockedTalents);
const commandUnlockAllTalents = createRunSessionCommand(unlockAllTalents);

export function useAlchemyRunController() {
  const homesteadEffects = useHomesteadEffects();
  const talentEffects = useTalentEffects();
  const contentSystemType = useContentSystemType();
  const characterId = useActiveRunCharacterId();
  const screen = useActiveRunScreenValue();
  const { navigateTo, transition, cancelPending } = useScreenTransitions(screen);

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

  const outcomes = useMemo(
    () =>
      createRunOutcomes({
        actions: { navigateTo, transition, clearCardHover: () => useUiStore.getState().clearCardHover() },
        getAvailableDestinations: getRunAvailableDestinations,
      }),
    [navigateTo, transition],
  );
  const battle = useBattleController({
    screen,
    setHoveredCardId,
    onBattleVictory: outcomes.victory.handleBattleVictory,
    onBattleDefeat: outcomes.defeat.handleBattleDefeat,
  });

  const gearAstralChanceBonus = homesteadEffects.gearAstralChanceBonus;
  const potionMixPotency = homesteadEffects.potionMixPotency;
  const shop = useMemo(
    () => createShopActions({ talentEffects, homesteadEffects: { gearAstralChanceBonus, potionMixPotency } }),
    [talentEffects, gearAstralChanceBonus, potionMixPotency],
  );

  const labyrinth = useMemo(() => createLabyrinthController(), []);

  const battleLauncher = useMemo(
    () => ({
      onStartBattle: battle.startBattle,
      onStartBossBattle: battle.startBossBattle,
      onStartBossById: battle.startBossById,
    }),
    [battle.startBattle, battle.startBossBattle, battle.startBossById],
  );

  const nav = useRunFlowEngine(
    {
      screen,
      navigateTo,
      transition,
      cancelPending,
      battle: battleLauncher,
      initializeShop: shop.initialize,
      labyrinthClearNode: labyrinth.onNodeCleared,
    },
    outcomes,
  );

  useSteamRichPresence(screen, nav.runPhase, characterId);

  const hasActiveBattle = battle.hasActiveBattle;
  const handleBattleEndRun = battle.handleEndRun;
  const handleAbandonRun = nav.handleAbandonRun;

  const resetCorruptionResult = useCallback(() => {
    dispatchRunSessionCommand((draft) => setCorruptionResult(draft, null));
  }, []);

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
        corruption: { reset: resetCorruptionResult },
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
      resetCorruptionResult,
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
        beginLabyrinth: nav.beginLabyrinth,
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
          descend: labyrinth.descend,
        },
        rewards: {
          skip: nav.skipRewards,
          claimChoice: nav.claimRewardChoice,
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
    [nav, nodeRouting, labyrinth, shop, battle],
  );

  return {
    screen,
    homesteadEffects,
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
