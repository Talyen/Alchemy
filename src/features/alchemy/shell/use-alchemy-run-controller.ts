import { guardProgressAction } from "@/features/alchemy/shared/stores/session-capabilities";
import { createSessionPersistence } from "@/features/alchemy/shared/storage";
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
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { getRunPhase } from "@/lib/routing";
import { createLabyrinthNodeRouting } from "./labyrinth-node-routing";
import { createRunRouteActions } from "./run-route-actions";
import { useBattleController } from "./use-battle-controller";
import { createLabyrinthController } from "@/features/alchemy/run-loop/run/labyrinth-controller";
import { createRunFlowEngine } from "./run-flow-engine";
import { useScreenTransitions } from "./use-screen-transitions";
import { useSteamRichPresence } from "./use-steam-rich-presence";

const protectVoid = <Args extends unknown[]>(action: (...args: Args) => void) =>
  guardProgressAction(defaultGameSession, action, undefined);

export function useAlchemyRunController(): AlchemyRunCommands {
  const persistence = useMemo(() => createSessionPersistence(defaultGameSession), []);
  const progressSave = useSyncExternalStore(persistence.subscribeProgress, persistence.readProgress);
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
        },
        outcomes,
        defaultGameSession,
      ),
    [navigateTo, resumeTo, transition, cancelPending, battle, outcomes],
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
      progress: {
        isPending: () => persistence.readProgress().kind !== "idle",
        afterSaved: persistence.afterProgressSaved,
      },
      meta: {
        resumeRun: nav.returnToBattle,
        goToScreen: nav.goToScreen,
        beginCampaign: protectVoid(nav.beginCampaign),
        beginLabyrinth: protectVoid(nav.beginLabyrinth),
        beginWildwood: protectVoid(nav.beginWildwood),
        unlockTalent: protectVoid(runActions.purchaseTalent),
        resetUnlockedTalents: protectVoid(runActions.resetTalentUnlocks),
      },
      runSetup: {
        goToScreen: nav.goToScreen,
        handleCharacterSelect: protectVoid(nav.handleCharacterSelect),
        handleStandardDraftComplete: protectVoid(nav.handleStandardDraftComplete),
        handleWildwoodDraftComplete: protectVoid(nav.handleWildwoodDraftComplete),
        handleWildwoodDraftPick: protectVoid(nav.handleWildwoodDraftPick),
        handleStarterDraftPick: protectVoid(nav.handleStarterDraftPick),
        handleDifficultySelect: protectVoid(nav.handleDifficultySelect),
        handleBackFromDifficultySelect: protectVoid(nav.handleBackFromDifficultySelect),
      },
      runLoop: {
        labyrinth: {
          handleNodeSelect: protectVoid(labyrinth.selectNode),
          handleNodeDeselect: protectVoid(labyrinth.deselectNode),
          handleNodeEnter: guardProgressAction(defaultGameSession, nodeRouting.handleLabyrinthNodeEnter, false),
          descend: protectVoid(labyrinth.descend),
        },
        rewards: {
          skip: protectVoid(nav.skipRewards),
          claimChoice: protectVoid(nav.claimRewardChoice),
        },
        destinations: {
          prepare: protectVoid(nav.prepareDestinationScreen),
          choose: protectVoid(nav.handleDestinationChoice),
          continueCampfire: protectVoid(nav.handleCampfireContinue),
          rest: guardProgressAction(defaultGameSession, runActions.restAtCampfire, false),
          brew: guardProgressAction(defaultGameSession, runActions.brewAtCampfire, null),
        },
        wildwood: {
          removeCard: protectVoid(nav.handleWildwoodRemoveCard),
          skipRemoval: protectVoid(nav.handleWildwoodSkipRemoval),
        },
        shop: { ...shop, continue: protectVoid(nav.advanceToNextDestination) },
        mystery: {
          handleChoice: guardProgressAction(defaultGameSession, nav.handleMysteryChoice, false),
          handleChooseCard: guardProgressAction(defaultGameSession, nav.handleMysteryChooseCard, false),
          handleContinue: protectVoid(nav.handleMysteryContinue),
        },
        transmutation: {
          select: guardProgressAction(defaultGameSession, runActions.selectTransmutation, false),
          exchange: guardProgressAction(defaultGameSession, runActions.transmuteCard, null),
          continue: protectVoid(nav.advanceToNextDestination),
        },
        corruption: {
          handleCorruptCard: protectVoid(nav.handleCorruptCard),
          handleExit: protectVoid(nav.handleCorruptionExit),
        },
      },
      battle,
      runEnd: {
        continueFromRunEnd: protectVoid(nav.continueFromRunEnd),
      },
    }),
    [nav, nodeRouting, labyrinth, shop, battle, runActions, persistence],
  );

  return {
    screen,
    navigationPending,
    progressSave,
    retryProgressSave: persistence.retryProgress,
    routeCommands,
    unlockAllTalents: runActions.unlockTalentsForDevelopment,
    returnToBattle: nav.returnToBattle,
    goToScreen: nav.goToScreen,
    handleEndRun: protectVoid(handleEndRun),
    resetRunState: protectVoid(nav.resetRunState),
  };
}
