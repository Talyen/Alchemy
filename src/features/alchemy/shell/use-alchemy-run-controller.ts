import { brewAtCampfire, transmuteCard } from "@/features/alchemy/run-loop/navigation/alchemy-commands";
import { restAtCampfire } from "@/features/alchemy/run-loop/run/destination-commands";
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
} from "@/features/alchemy/shared/stores/navigation-commands";
import { useCallback, useMemo } from "react";
import { getRunPhase } from "@/lib/routing";
import { createLabyrinthNodeRouting } from "./labyrinth-node-routing";
import { clearRunCardHover, readRunAvailableDestinations } from "./run-destination-wiring";
import { useBattleController } from "./use-battle-controller";
import { createLabyrinthController } from "@/features/alchemy/run-loop/run/labyrinth-controller";
import { createRunFlowEngine } from "./run-flow-engine";
import { useScreenTransitions } from "./use-screen-transitions";
import { useSteamRichPresence } from "./use-steam-rich-presence";

export function useAlchemyRunController(): AlchemyRunCommands {
  const homesteadEffects = useHomesteadEffects();
  const talentEffects = useTalentEffects();
  const characterId = useActiveRunCharacterId();
  const screen = useActiveRunScreenValue();
  const { navigateTo, resumeTo, transition, cancelPending, navigationPending } = useScreenTransitions(screen);

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
      ),
    [navigateTo, resumeTo, transition, cancelPending, battle, labyrinth, outcomes],
  );

  const runPhase = getRunPhase(screen, battle.hasActiveBattle);
  useSteamRichPresence(screen, runPhase, characterId);

  const cancelBattle = battle.cancelBattle;
  const handleAbandonRun = nav.handleAbandonRun;

  const nodeRouting = useMemo(
    () =>
      createLabyrinthNodeRouting({
        navigateTo,
        labyrinth,
        presentBattleStart: battle.presentBattleStart,
      }),
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
          rest: restAtCampfire,
          brew: brewAtCampfire,
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
        transmutation: { exchange: transmuteCard, continue: nav.advanceToNextDestination },
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
