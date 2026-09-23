import type { AlchemyRouteCommands, AlchemyRunCommands } from "./route-commands";
import { createRunOutcomes } from "@/features/alchemy/run-loop/run/run-flow";
import { createShopActions } from "@/features/alchemy/run-loop/shop/create-shop-actions";
import {
  useActiveRunCharacterId,
  useActiveRunScreenValue,
  useHomesteadEffects,
  useTalentEffects,
} from "@/features/alchemy/shared/stores/run-reads";
import {
  purchaseTalent,
  resetTalentUnlocks,
  unlockTalentsForDevelopment,
  prepareLabyrinthRoomTraits,
  resetCorruptionVisit,
} from "@/features/alchemy/shared/stores/navigation-commands";
import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";
import { useCallback, useMemo } from "react";
import { createLabyrinthNodeRouting } from "./labyrinth-node-routing";
import { clearRunCardHover, readRunAvailableDestinations } from "./run-destination-wiring";
import { useBattleController } from "./use-battle-controller";
import { createLabyrinthController } from "@/features/alchemy/run-loop/run/labyrinth-controller";
import { useRunFlowEngine } from "./use-run-flow-engine";
import { useScreenTransitions } from "./use-screen-transitions";
import { useSteamRichPresence } from "./use-steam-rich-presence";

export function useAlchemyRunController(): AlchemyRunCommands {
  const homesteadEffects = useHomesteadEffects();
  const talentEffects = useTalentEffects();
  const characterId = useActiveRunCharacterId();
  const screen = useActiveRunScreenValue();
  const { navigateTo, resumeTo, transition, cancelPending, navigationPending } = useScreenTransitions(screen);

  const setHoveredCardId = useCallback((id: string | null | ((prev: string | null) => string | null)) => {
    const store = useUiStore.getState();
    store.setHoveredCardId(typeof id === "function" ? id(store.hoveredCardId) : id);
  }, []);
  const outcomes = useMemo(
    () =>
      createRunOutcomes({
        actions: { navigateTo, transition, clearCardHover: clearRunCardHover },
        getAvailableDestinations: readRunAvailableDestinations,
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
  const mixPotionDiscount = homesteadEffects.mixPotionDiscount;
  const removeCardDiscount = homesteadEffects.removeCardDiscount;
  const shop = useMemo(
    () =>
      createShopActions({
        talentEffects,
        homesteadEffects: { gearAstralChanceBonus, mixPotionDiscount, removeCardDiscount },
      }),
    [talentEffects, gearAstralChanceBonus, mixPotionDiscount, removeCardDiscount],
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
      resumeTo,
      transition,
      cancelPending,
      battle: battleLauncher,
      initializeShop: shop.initialize,
      labyrinthClearNode: labyrinth.onNodeCleared,
    },
    outcomes,
  );

  useSteamRichPresence(screen, nav.runPhase, characterId);

  const cancelBattle = battle.cancelBattle;
  const handleAbandonRun = nav.handleAbandonRun;

  const nodeRouting = useMemo(
    () =>
      createLabyrinthNodeRouting({
        prepareRoomTraits: prepareLabyrinthRoomTraits,
        navigateTo,
        labyrinth,
        battle: {
          startBattle: battle.startBattle,
          startBossBattle: battle.startBossBattle,
        },
        nav: { beginMysteryEvent: nav.beginMysteryEvent },
        shop,
        corruption: { reset: resetCorruptionVisit },
      }),
    [navigateTo, labyrinth, battle.startBattle, battle.startBossBattle, nav.beginMysteryEvent, shop],
  );

  const handleEndRun = useCallback(() => {
    cancelBattle();
    handleAbandonRun();
  }, [cancelBattle, handleAbandonRun]);

  const routeCommands = useMemo<AlchemyRouteCommands>(
    () => ({
      meta: {
        resumeRun: nav.returnToBattle,
        goToScreen: nav.goToScreen,
        beginCampaign: nav.beginCampaign,
        beginLabyrinth: nav.beginLabyrinth,
        beginWildwood: nav.beginWildwood,
        unlockTalent: purchaseTalent,
        resetUnlockedTalents: resetTalentUnlocks,
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
        shop: { ...shop, continue: nav.advanceToNextDestination },
        mystery: {
          handleChoice: nav.handleMysteryChoice,
          handleChooseCard: nav.handleMysteryChooseCard,
          handleContinue: nav.handleMysteryContinue,
        },
        corruption: {
          handleCorruptCard: nav.handleCorruptCard,
          handleExit: nav.handleCorruptionExit,
        },
      },
      battle,
      runEnd: {
        continueFromRunEnd: nav.continueFromRunEnd,
      },
    }),
    [nav, nodeRouting, labyrinth, shop, battle],
  );

  return {
    screen,
    navigationPending,
    homesteadEffects,
    routeCommands,
    unlockAllTalents: unlockTalentsForDevelopment,
    returnToBattle: nav.returnToBattle,
    goToScreen: nav.goToScreen,
    handleEndRun,
    resetRunState: nav.resetRunState,
  };
}
