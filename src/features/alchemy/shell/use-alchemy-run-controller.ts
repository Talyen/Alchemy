import { defaultGameSession } from "@/app/application-session";
import type { AlchemyRouteCommands, AlchemyRunCommands } from "./route-commands";
import { createRunOutcomes } from "@/features/alchemy/run-loop/run/run-flow";
import { createShopActions } from "@/features/alchemy/run-loop/shop/create-shop-actions";
import {
  useActiveRunCharacterId,
  useActiveRunScreenValue,
  useHomesteadEffects,
  useTalentEffects,
} from "@/features/alchemy/shared/stores/run-reads";
import { useCallback, useMemo } from "react";
import { getRunPhase } from "@/lib/routing";
import { createLabyrinthNodeRouting } from "./labyrinth-node-routing";
import { createRunRouteActions } from "./run-route-actions";
import { useBattleController } from "./use-battle-controller";
import { createLabyrinthController } from "@/features/alchemy/run-loop/run/labyrinth-controller";
import { createRunFlowEngine } from "./run-flow-engine";
import { useScreenTransitions } from "./use-screen-transitions";
import { useSteamRichPresence } from "./use-steam-rich-presence";

export function useAlchemyRunController(): AlchemyRunCommands {
  const runActions = useMemo(() => createRunRouteActions(defaultGameSession), []);
  const homesteadEffects = useHomesteadEffects();
  const talentEffects = useTalentEffects();
  const characterId = useActiveRunCharacterId();
  const screen = useActiveRunScreenValue();
  const { navigateTo, resumeTo, transition, cancelPending, navigationPending } = useScreenTransitions(screen);

  const outcomes = useMemo(
    () =>
      createRunOutcomes(
        {
          actions: { navigateTo, transition, clearCardHover: runActions.clearCardHover },
          getAvailableDestinations: runActions.getAvailableDestinations,
        },
        defaultGameSession,
      ),
    [navigateTo, transition, runActions],
  );
  const battle = useBattleController({
    screen,
    onBattleVictory: outcomes.victory.handleBattleVictory,
    onBattleDefeat: outcomes.defeat.handleBattleDefeat,
  });

  const gearAstralChanceBonus = homesteadEffects.gearAstralChanceBonus;
  const mixPotionDiscount = homesteadEffects.mixPotionDiscount;
  const removeCardDiscount = homesteadEffects.removeCardDiscount;
  const shop = useMemo(
    () =>
      createShopActions(
        {
          talentEffects,
          homesteadEffects: { gearAstralChanceBonus, mixPotionDiscount, removeCardDiscount },
        },
        defaultGameSession,
      ),
    [talentEffects, gearAstralChanceBonus, mixPotionDiscount, removeCardDiscount],
  );
  const labyrinth = useMemo(() => createLabyrinthController(defaultGameSession), []);

  const nav = useMemo(
    () =>
      createRunFlowEngine(
        {
          navigateTo,
          resumeTo,
          transition,
          cancelPending,
          battle,
          labyrinthClearNode: labyrinth.onNodeCleared,
        },
        outcomes,
        defaultGameSession,
      ),
    [navigateTo, resumeTo, transition, cancelPending, battle, labyrinth, outcomes],
  );

  const runPhase = getRunPhase(screen, battle.hasActiveBattle);
  useSteamRichPresence(screen, runPhase, characterId);

  const cancelBattle = battle.cancelBattle;
  const handleAbandonRun = nav.handleAbandonRun;

  const nodeRouting = useMemo(
    () =>
      createLabyrinthNodeRouting(
        {
          navigateTo,
          labyrinth,
          presentBattleStart: battle.presentBattleStart,
        },
        defaultGameSession,
      ),
    [navigateTo, labyrinth, battle.presentBattleStart],
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
        unlockTalent: runActions.purchaseTalent,
        resetUnlockedTalents: runActions.resetTalentUnlocks,
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
          rest: runActions.restAtCampfire,
          brew: runActions.brewAtCampfire,
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
        transmutation: { exchange: runActions.transmuteCard, continue: nav.advanceToNextDestination },
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
    [nav, nodeRouting, labyrinth, shop, battle, runActions],
  );

  return {
    screen,
    navigationPending,
    routeCommands,
    unlockAllTalents: runActions.unlockTalentsForDevelopment,
    returnToBattle: nav.returnToBattle,
    goToScreen: nav.goToScreen,
    handleEndRun,
    resetRunState: nav.resetRunState,
  };
}
