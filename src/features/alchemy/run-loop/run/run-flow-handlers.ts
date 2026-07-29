// Unified run-flow handlers: battle victory/defeat, rewards, destinations, and run completion.
import {
  readActiveRunStore,
  readBattleStore,
  readRunSessionStore,
  awardMaterialsDuringRun,
  beginDestinationClaim,
  beginRewardClaim,
  cancelDestinationClaim,
  commitDestinationClaim,
  finalizeRunXP,
  releaseRewardClaim as releaseRewardClaimState,
} from "../../shared/stores/run-session-facade";
import { setCompanionRewardCards, setCorruptionResult, setRewardState } from "../../shared/stores/run-session-facade";
import { useUiStore } from "../../shared/stores/ui-store";
import { playUISound, playVictory, stopAllSfx } from "@/lib/audio";
import type { MaterialInventory } from "@/lib/homestead/types";
import {
  ACTS_PER_RUN,
  getCampfireHealFraction,
  getCampfireRestHealth,
  VICTORY_TRANSITION_DELAY,
} from "@/lib/game-constants";
import { getBossEnemy, getBossById } from "@/features/alchemy/shared/config";
import { computeVictoryRewards, commitVictoryRewards, type VictoryRewardsResult } from "../navigation/victory-flow";
import {
  finalizeRewardState,
  getActiveRewardModifiersForContentSystem,
  shouldGrantAlchemistReward,
  executeRewardRouteTransition,
} from "../navigation/reward-flow";
import { applyRunDefeatTeardown, clearBattleUi, finalizeRunEndSession } from "../../shared/stores/run-session-facade";
import { applyAlchemistPotion, applyRewardSelection, routeDestinationChoice } from "./run-destination-handlers";
import { CONSTANTS, type Destination } from "../../shared/types";
import { getActiveRewardTraits, type RunFlowHandlerDeps } from "./run-flow-handler-deps";
import { awardRunEndMaterials, clearCombatState } from "./run-flow-session-helpers";

export function createRunFlowHandlers(deps: RunFlowHandlerDeps) {
  function computeVictoryResult() {
    const runState = readActiveRunStore();
    return computeVictoryRewards(
      {
        characterId: runState.characterId,
        selectedDifficulty: runState.selectedDifficulty,
        unlockedTalents: runState.unlockedTalents,
        runDeck: runState.runDeck,
        runTrinkets: runState.runTrinkets,
        contentSystemType: runState.contentSystemType,
        activeLabyrinthRewardModifiers: getActiveRewardTraits(runState.contentSystemType),
        battleState: readBattleStore().battleState,
        runGold: runState.runGold,
        runPlayerHealth: runState.runPlayerHealth,
        runMaxHealth: runState.runMaxHealth,
        destinationIndexInAct: runState.destinationIndexInAct,
        completedDestinations: runState.completedDestinations,
        homesteadEffects: runState.effects,
        getAvailableDestinations: deps.getAvailableDestinations,
        bossEnemyId: getBossEnemy([], deps.worldRng).id,
        destinationOfferState: {
          lastOfferedDestinations: runState.lastOfferedDestinations,
          roundsSinceOffered: runState.destinationRoundsSinceOffered,
        },
      },
      deps.rewardRng,
      deps.destinationRng,
    );
  }

  function commitVictoryResult(result: VictoryRewardsResult) {
    const battleState = readBattleStore().battleState;
    const runState = readActiveRunStore();
    commitVictoryRewards(
      result,
      {
        battleState,
        contentSystemType: runState.contentSystemType,
        addHomesteadMaterials: awardMaterialsDuringRun,
        addRunGold: runState.addRunGold,
        setRunMaxHealth: runState.setRunMaxHealth,
        setRewardState,
        setCompanionRewardCards,
        setDestinationOfferState: runState.setDestinationOfferState,
        clearCombatState,
      },
      deps.rewardRng,
    );
    if (runState.contentSystemType === CONSTANTS.CONTENT_SYSTEMS.WILDWOOD) {
      deps.onCommitWildwoodVictory(result);
    }
  }

  function handleBattleVictory() {
    commitVictoryResult(computeVictoryResult());
    stopAllSfx();
    playVictory();
    if (readRunSessionStore().hasActiveRun) {
      const nextScreen =
        readActiveRunStore().contentSystemType === CONSTANTS.CONTENT_SYSTEMS.WILDWOOD
          ? CONSTANTS.SCREENS.WILDWOOD_RECOVERY
          : CONSTANTS.SCREENS.REWARDS;
      deps.transition(nextScreen, {
        delayMs: VICTORY_TRANSITION_DELAY,
        guard: () => readRunSessionStore().hasActiveRun,
      });
    }
  }

  function endRunAndShowGameOver() {
    applyRunDefeatTeardown({
      awardRunEndMaterials,
      finalizeRunXP,
      clearCombatState,
    });
    deps.transition(CONSTANTS.SCREENS.GAME_OVER, { immediate: true });
  }

  function handleBattleDefeat() {
    const runState = readActiveRunStore();
    if (runState.contentSystemType === CONSTANTS.CONTENT_SYSTEMS.LABYRINTH) {
      stopAllSfx();
      clearCombatState();
      deps.onLabyrinthFailNode();
      deps.navigateTo(CONSTANTS.SCREENS.LABYRINTH_MAP);
      return;
    }
    endRunAndShowGameOver();
  }

  function handleAbandonRun() {
    useUiStore.getState().clearCardHover();
    if (deps.run.contentSystemType === CONSTANTS.CONTENT_SYSTEMS.LABYRINTH) {
      endLabyrinthRun();
      return;
    }
    endRunAndShowGameOver();
  }

  function prepareNextDestination(destinationIndexInAct: number = 0, onCommitted?: () => void) {
    deps.navigateTo(CONSTANTS.SCREENS.DESTINATION, () => {
      setRewardState(deps.contentNav.createInitialDestinations({ destinationIndexInAct }));
      prepareDestinationScreen();
      onCommitted?.();
    });
  }

  function handleActComplete(displayMaterials?: MaterialInventory) {
    clearBattleUi();
    if (deps.run.currentAct >= ACTS_PER_RUN) {
      if (deps.run.selectedDifficulty) {
        deps.onMarkDifficultyCompleted(deps.run.characterId, deps.run.selectedDifficulty);
      }
      completeRunVictory(displayMaterials);
      return;
    }
    deps.run.setCurrentAct((p) => p + 1);
    deps.run.setDestinationIndexInAct(0);
    deps.run.setCompletedDestinations([]);
    prepareNextDestination(0);
  }

  function completeRunVictory(displayMaterials: MaterialInventory | null = null, onRenderedScreenCommit?: () => void) {
    clearBattleUi();
    finalizeRunEndSession({
      awardRunEndMaterials,
      finalizeRunXP,
      displayMaterials,
    });
    deps.navigateTo(CONSTANTS.SCREENS.RUN_VICTORY, onRenderedScreenCommit);
  }

  function advanceToNextDestination() {
    deps.run.setRoomsEncountered((p) => p + 1);
    if (deps.run.contentSystemType === CONSTANTS.CONTENT_SYSTEMS.LABYRINTH) {
      deps.onLabyrinthClearNode();
      useUiStore.getState().clearCardHover();
      deps.navigateTo(CONSTANTS.SCREENS.LABYRINTH_MAP);
      return;
    }
    useUiStore.getState().clearCardHover();
    deps.clearMysteryCardChoices();
    prepareNextDestination();
  }

  function prepareDestinationScreen() {
    const state = readRunSessionStore().rewardState;
    const bossOnly = state.destinations.length === 1 && state.destinations[0] === CONSTANTS.DESTINATIONS.BOSS_COMBAT;
    if (!bossOnly) return;
    if (state.selectedBossId && getBossById(state.selectedBossId)) return;
    setRewardState((prev) => ({ ...prev, selectedBossId: getBossEnemy([], deps.worldRng).id }));
  }

  function selectRewardChoice(id: string) {
    setRewardState((prev) => ({ ...prev, selectedId: id }));
    deps.onSelectRewardChoice?.(id);
  }

  function finishRewards() {
    if (!beginRewardClaim()) return;
    const session = readRunSessionStore();

    const grantAlchemistReward = shouldGrantAlchemistReward(
      getActiveRewardModifiersForContentSystem(
        deps.run.contentSystemType,
        getActiveRewardTraits(deps.run.contentSystemType),
      ),
    );
    const result = finalizeRewardState({
      rewardState: session.rewardState,
      companionRewardCards: session.companionRewardCards,
    });

    // Apply the post-claim persistable surface immediately so autosave cannot
    // snapshot an empty rewards screen. Companion route keeps choices (the
    // companion offer); other routes keep destinations with choices cleared.
    setRewardState(result.nextRewardState);
    if (result.clearCompanionRewardCards) setCompanionRewardCards(null);

    const releaseRewardClaim = () => {
      releaseRewardClaimState();
    };

    const isWildwood = deps.run.contentSystemType === CONSTANTS.CONTENT_SYSTEMS.WILDWOOD;
    if (!isWildwood) awardMaterialsDuringRun(result.materials);

    if (result.selectedChoice) {
      applyRewardSelection({
        choice: result.selectedChoice,
        type: result.selectedRewardType,
        setRunDeck: deps.run.setRunDeck,
        setRunTrinkets: deps.run.setRunTrinkets,
      });
      playUISound("talentUnlock");
    }
    if (grantAlchemistReward) {
      applyAlchemistPotion({ setRunDeck: deps.run.setRunDeck, rng: deps.rewardRng });
    }

    useUiStore.getState().clearCardHover();
    if (isWildwood && result.route !== CONSTANTS.REWARD_ROUTES.COMPANION_REWARD) {
      releaseRewardClaim();
      deps.onWildwoodRewardComplete();
      return;
    }
    executeRewardRouteTransition(
      result.route,
      result.materials,
      result.nextRewardState,
      false, // companion cards already cleared above when needed
      {
        navigateTo: (screen, onCommit) => {
          deps.navigateTo(screen, () => {
            releaseRewardClaim();
            onCommit?.();
          });
        },
        completeRunVictory: (materials, onCommit) => {
          completeRunVictory(materials, () => {
            releaseRewardClaim();
            onCommit?.();
          });
        },
        handleActComplete: (materials) => {
          releaseRewardClaim();
          handleActComplete(materials);
        },
        onLabyrinthClearNode: deps.onLabyrinthClearNode,
        setCompanionRewardCards,
        setRewardState,
      },
    );
  }

  function handleDestinationChoice(destination: Destination) {
    if (!beginDestinationClaim(destination)) return;
    const rewardState = readRunSessionStore().rewardState;

    const selectedBossId = destination === CONSTANTS.DESTINATIONS.BOSS_COMBAT ? rewardState.selectedBossId : null;

    const commitDestinationProgress = () => {
      commitDestinationClaim(destination);
    };

    try {
      useUiStore.getState().clearCardHover();
      routeDestinationChoice(destination, {
        navigateTo: (screen) => deps.navigateTo(screen, commitDestinationProgress),
        beginMysteryEvent: () => {
          // Mystery owns its navigateTo; commit the offer surface before starting.
          commitDestinationProgress();
          deps.beginMysteryEvent();
        },
        resetCorruption: () => setCorruptionResult(null),
        startShop: deps.onInitShop,
        startAlchemist: deps.onInitAlchemist,
        startTrinketShop: deps.onInitTrinketShop,
        startEquipmentShop: deps.onInitEquipmentShop,
        startBattle: (enemyType) => deps.onStartBattle(undefined, undefined, enemyType),
        startBossBattle: () => {
          if (selectedBossId && deps.onStartBossById(selectedBossId)) return;
          deps.onStartBossBattle();
        },
      });
    } catch (error) {
      cancelDestinationClaim();
      throw error;
    }
  }

  function endLabyrinthRun() {
    if (deps.run.contentSystemType !== CONSTANTS.CONTENT_SYSTEMS.LABYRINTH) return;
    endRunAndShowGameOver();
  }

  function handleCampfireContinue() {
    const healFraction = getCampfireHealFraction(deps.talents.talentEffects.campfireHealBonus);
    deps.run.setRunPlayerHealth((prev) => getCampfireRestHealth(prev, deps.run.runMaxHealth, healFraction));
    advanceToNextDestination();
  }

  return {
    clearCombatState,
    awardRunEndMaterials,
    computeVictoryResult,
    commitVictoryResult,
    handleBattleVictory,
    handleBattleDefeat,
    handleAbandonRun,
    finishRewards,
    selectRewardChoice,
    prepareDestinationScreen,
    handleDestinationChoice,
    endLabyrinthRun,
    handleActComplete,
    completeRunVictory,
    advanceToNextDestination,
    handleCampfireContinue,
  };
}
