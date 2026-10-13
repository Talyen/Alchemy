import { guardProgressAction } from "@/features/alchemy/shared/stores/session-capabilities";
import { createSessionPersistence } from "@/features/alchemy/shared/storage";
import type { GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import type { BattlePresentationStore } from "@/features/alchemy/run-loop/battle/battle-presentation-store";
import { useRunControllerState } from "@/features/alchemy/shared/stores/use-session-run-reads";
import type { AlchemyRouteCommands, AlchemyRunCommands } from "./route-commands";
import { createRunOutcomes } from "@/features/alchemy/run-loop/run/run-flow";
import { createShopActions } from "@/features/alchemy/run-loop/shop/create-shop-actions";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { createLabyrinthNodeRouting } from "./labyrinth-node-routing";
import { createRunRouteActions } from "./run-route-actions";
import { useBattleController } from "./use-battle-controller";
import { createLabyrinthController } from "@/features/alchemy/run-loop/run/labyrinth-controller";
import { createRunFlowEngine } from "./run-flow-engine";
import { useScreenTransitions } from "./use-screen-transitions";

import { isAlchemyDevBuild } from "@/features/alchemy/shared/utils";

export function useAlchemyRunController(
  gameSession: GameSession,
  presentation: BattlePresentationStore,
): AlchemyRunCommands {
  const protectVoid = useMemo(
    () =>
      <Args extends unknown[]>(action: (...args: Args) => void) =>
        guardProgressAction(gameSession, action, undefined),
    [gameSession],
  );
  const persistence = useMemo(() => createSessionPersistence(gameSession), [gameSession]);
  const progressSave = useSyncExternalStore(persistence.subscribeProgress, persistence.readProgress);
  const runActions = useMemo(() => createRunRouteActions(gameSession), [gameSession]);
  const { screen } = useRunControllerState(gameSession);
  const { navigateTo, resumeTo, transition, cancelPending, navigationPending } = useScreenTransitions(
    gameSession,
    screen,
  );

  const outcomes = useMemo(
    () =>
      createRunOutcomes(
        {
          actions: { navigateTo, transition, clearCardHover: runActions.clearCardHover },
        },
        gameSession,
      ),
    [navigateTo, transition, runActions, gameSession],
  );
  const battle = useBattleController({
    gameSession,
    presentation,
    screen,
    onBattleVictory: outcomes.victory.handleBattleVictory,
    onBattleDefeat: outcomes.defeat.handleBattleDefeat,
  });

  const shop = useMemo(() => createShopActions(gameSession), [gameSession]);
  const labyrinth = useMemo(() => createLabyrinthController(gameSession), [gameSession]);

  const nav = useMemo(
    () =>
      createRunFlowEngine(
        {
          navigateTo,
          resumeTo,
          transition,
          cancelPending,
          battle: {
            startBattle: battle.startBattle,
            startBossBattle: battle.startBossBattle,
            startBossById: battle.startBossById,
            presentBattleStart: battle.presentBattleStart,
          },
        },
        outcomes,
        gameSession,
      ),
    [navigateTo, resumeTo, transition, cancelPending, battle, outcomes, gameSession],
  );

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
        gameSession,
      ),
    [navigateTo, labyrinth, battle.presentBattleStart, gameSession],
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
        resetHomestead: guardProgressAction(gameSession, runActions.resetHomestead, false),
        constructBuilding: guardProgressAction(gameSession, runActions.constructBuilding, false),
        plantFarm: guardProgressAction(gameSession, runActions.plantFarm, false),
        completeResearch: guardProgressAction(gameSession, runActions.completeResearch, false),
        bondCompanion: guardProgressAction(gameSession, runActions.bondCompanion, false),
        selectCollectionTab: protectVoid(runActions.selectCollectionTab),
        setCollectionPage: protectVoid(runActions.setCollectionPage),
        armory: {
          onEquip: guardProgressAction(gameSession, runActions.equipGear, false),
          onUnequip: protectVoid(runActions.unequipGear),
          onEquipTrinket: protectVoid(runActions.equipTrinket),
          onUnequipTrinket: protectVoid(runActions.unequipTrinket),
          onSalvage: guardProgressAction(gameSession, runActions.salvageGear, false),
          onApplyCurrency: guardProgressAction(
            gameSession,
            (currencyId, instanceId) => runActions.applyCurrencyToGear(currencyId, instanceId, undefined),
            false,
          ),
          ...(isAlchemyDevBuild()
            ? {
                onSpawnDevGear: protectVoid((characterId) => runActions.spawnDevGear(characterId, undefined)),
                onSpawnDevTrinket: protectVoid(() => runActions.spawnDevTrinket(undefined)),
              }
            : {}),
        },
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
          handleNodeSelect: labyrinth.selectNode,
          handleNodeDeselect: labyrinth.deselectNode,
          handleNodeEnter: guardProgressAction(gameSession, nodeRouting.handleLabyrinthNodeEnter, false),
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
          rest: guardProgressAction(gameSession, runActions.restAtCampfire, false),
          brew: guardProgressAction(gameSession, runActions.brewAtCampfire, null),
        },
        wildwood: {
          removeCard: protectVoid(nav.handleWildwoodRemoveCard),
          skipRemoval: protectVoid(nav.handleWildwoodSkipRemoval),
        },
        shop: { ...shop, continue: protectVoid(nav.advanceToNextDestination) },
        mystery: {
          handleChoice: guardProgressAction(gameSession, nav.handleMysteryChoice, false),
          handleChooseCard: guardProgressAction(gameSession, nav.handleMysteryChooseCard, false),
          handleContinue: protectVoid(nav.handleMysteryContinue),
        },
        transmutation: {
          select: guardProgressAction(gameSession, runActions.selectTransmutation, false),
          exchange: guardProgressAction(gameSession, runActions.transmuteCard, null),
          continue: protectVoid(() => nav.advanceToNextDestination("transmutation")),
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
    [nav, nodeRouting, labyrinth, shop, battle, runActions, persistence, gameSession, protectVoid],
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
