// Unified run-flow handlers: battle victory/defeat, rewards, destinations, and run completion.
import type { RefObject } from "react";
import { TimerGroup } from "@/lib/animation/game-timer";
import type { BattleCard, CharacterId, DifficultyId, DifficultyModifier } from "@/lib/game-data";
import type { LabyrinthModifierKind } from "@/lib/content-systems/types";
import { readActiveRunStore, readBattleStore, readRunSessionStore } from "../../shared/stores/run-session-facade";
import { useHomesteadStore } from "../../shared/stores/homestead-store";
import {
  setCompanionRewardCards,
  setCorruptionResult,
  setRewardState,
  setRunEndMaterials,
} from "../../shared/stores/run-session-facade";
import { useUiStore } from "../../shared/stores/ui-store";
import { playUISound, playVictory, stopAllSfx } from "@/lib/audio";
import { getEndOfRunMaterials, applyEndOfRunHomesteadBonuses } from "@/lib/homestead/loot";
import { addInventory } from "@/lib/homestead/inventory";
import type { MaterialInventory } from "@/lib/homestead/types";
import { ACTS_PER_RUN, CAMPFIRE_HEAL_FRACTION, VICTORY_TRANSITION_DELAY } from "@/lib/game-constants";
import { getBossEnemy, getBossById } from "@/features/alchemy/shared/config";
import { computeVictoryRewards, commitVictoryRewards } from "../navigation/victory-flow";
import {
  finalizeRewardState,
  getActiveRewardModifiersForContentSystem,
  shouldGrantAlchemistReward,
  executeRewardRouteTransition,
  type RewardState,
} from "../navigation/reward-flow";
import { applyRunDefeatTeardown, finalizeRunEndSession } from "@/features/alchemy/shared/stores/run-transitions";
import { createScreenTransition } from "@/features/alchemy/shell/screen-transition";
import { getPreviousDestination } from "../navigation/run-navigation-helpers";
import { applyAlchemistPotion, applyRewardSelection, routeDestinationChoice } from "./run-destination-handlers";
import type { ContentSystemNavigationApi } from "@/features/alchemy/run-setup/run/content-system-navigation";
import { CONSTANTS, type Destination, type Screen } from "../../shared/types";
import type { RunStateController, TalentStateController } from "../../shared/stores/run-session-facade";

type FinalizeRewardResultType = ReturnType<typeof finalizeRewardState>;

export type RunFlowHandlerDeps = {
  rewardTransitionTimer: RefObject<TimerGroup>;
  run: RunStateController;
  talents: TalentStateController;
  activeLabyrinthRewardModifiers: LabyrinthModifierKind[];
  navigateTo: (nextScreen: Screen, onRenderedScreenCommit?: () => void) => void;
  setScreen: React.Dispatch<React.SetStateAction<Screen>>;
  setHasActiveBattle: (value: boolean) => void;
  onLabyrinthFailNode: () => void;
  onLabyrinthClearNode: () => void;
  onInitShop: () => void;
  onInitAlchemist: () => void;
  onStartBattle: (deck?: BattleCard[], gold?: number, enemyType?: "normal" | "elite") => void;
  onStartBossBattle: () => void;
  onStartBossById: (bossId: string, modifiers?: DifficultyModifier[]) => boolean;
  onMarkDifficultyCompleted: (characterId: CharacterId, difficultyId: DifficultyId) => void;
  contentNav: Pick<ContentSystemNavigationApi, "createInitialDestinations">;
  getAvailableDestinations: (options?: {
    currentHealth?: number;
    currentGold?: number;
    destinationIndexInAct?: number;
    maxHealth?: number;
  }) => Destination[];
  beginMysteryEvent: () => void;
  clearMysteryCardChoices: () => void;
};

export function createRunFlowHandlers(deps: RunFlowHandlerDeps) {
  const transitionScreen = createScreenTransition(
    { navigateTo: deps.navigateTo, setScreen: deps.setScreen },
    deps.rewardTransitionTimer,
  );
  const transitionScreenImmediate = createScreenTransition({ navigateTo: deps.navigateTo, setScreen: deps.setScreen });

  function clearCombatState() {
    readBattleStore().setHasActiveBattle(false);
    useUiStore.getState().clearCardHover();
  }

  function awardRunEndMaterials(displayMaterials: MaterialInventory | null = null) {
    const runState = readActiveRunStore();
    const homesteadEffects = useHomesteadStore.getState().effects;
    const baseMats = getEndOfRunMaterials(runState.roomsEncountered, runState.currentAct);
    const mats = applyEndOfRunHomesteadBonuses(baseMats, homesteadEffects, runState.roomsEncountered);
    useHomesteadStore.getState().addMaterials(mats);
    setRunEndMaterials(displayMaterials ? addInventory(displayMaterials, mats) : mats);
    return mats;
  }

  function computeVictoryResult() {
    const runState = readActiveRunStore();
    const lobby = useHomesteadStore.getState();
    return computeVictoryRewards({
      characterId: runState.characterId,
      selectedDifficulty: runState.selectedDifficulty,
      unlockedTalents: runState.unlockedTalents,
      runDeck: runState.runDeck,
      runTrinkets: runState.runTrinkets,
      contentSystemType: runState.contentSystemType,
      activeLabyrinthRewardModifiers: readRunSessionStore().activeLabyrinthRewardModifiers,
      battleState: readBattleStore().battleState,
      runGold: runState.runGold,
      runPlayerHealth: runState.runPlayerHealth,
      runMaxHealth: runState.runMaxHealth,
      destinationIndexInAct: runState.destinationIndexInAct,
      completedDestinations: runState.completedDestinations,
      homesteadEffects: lobby.effects,
      getAvailableDestinations: deps.getAvailableDestinations,
      bossEnemyId: getBossEnemy().id,
    });
  }

  function commitVictoryResult(result: ReturnType<typeof computeVictoryRewards>) {
    const battleState = readBattleStore().battleState;
    const runState = readActiveRunStore();
    commitVictoryRewards(result, {
      battleState,
      contentSystemType: runState.contentSystemType,
      addHomesteadMaterials: (materials) => useHomesteadStore.getState().addMaterials(materials),
      addRunGold: runState.addRunGold,
      setRunMaxHealth: runState.setRunMaxHealth,
      setRewardState,
      setCompanionRewardCards,
      clearCombatState,
    });
  }

  function handleBattleVictory() {
    deps.rewardTransitionTimer.current.clearAll();
    commitVictoryResult(computeVictoryResult());
    stopAllSfx();
    playVictory();
    if (readRunSessionStore().hasActiveRun) {
      transitionScreen(CONSTANTS.SCREENS.REWARDS, {
        delayMs: VICTORY_TRANSITION_DELAY,
        guard: () => readRunSessionStore().hasActiveRun,
      });
    }
  }

  function handleBattleDefeat() {
    deps.rewardTransitionTimer.current.clearAll();
    const runState = readActiveRunStore();
    if (runState.contentSystemType === CONSTANTS.CONTENT_SYSTEMS.LABYRINTH) {
      stopAllSfx();
      clearCombatState();
      deps.onLabyrinthFailNode();
      deps.navigateTo(CONSTANTS.SCREENS.LABYRINTH_MAP);
      return;
    }
    applyRunDefeatTeardown({
      awardRunEndMaterials,
      finalizeRunXP: deps.talents.finalizeRunXP,
      clearCombatState,
    });
    transitionScreen(CONSTANTS.SCREENS.GAME_OVER, { immediate: true });
  }

  function routeAfterReward(
    route: FinalizeRewardResultType["route"],
    materials: MaterialInventory,
    nextRewardState: RewardState,
    clearCompanion: boolean,
  ) {
    executeRewardRouteTransition(route, materials, nextRewardState, clearCompanion, {
      navigateTo: deps.navigateTo,
      completeRunVictory,
      handleActComplete,
      onLabyrinthClearNode: deps.onLabyrinthClearNode,
      setCompanionRewardCards,
      setRewardState,
    });
  }

  function applyFinalizedRewards(result: ReturnType<typeof finalizeRewardState>) {
    if (result.selectedChoice) {
      applyRewardSelection({
        choice: result.selectedChoice,
        type: result.selectedRewardType,
        setRunDeck: deps.run.setRunDeck,
        setRunTrinkets: deps.run.setRunTrinkets,
      });
      playUISound("talentUnlock");
    }

    if (result.grantAlchemistReward) {
      applyAlchemistPotion({ setRunDeck: deps.run.setRunDeck });
    }
  }

  function finishRewards() {
    const session = readRunSessionStore();
    const result = finalizeRewardState({
      rewardState: session.rewardState,
      companionRewardCards: session.companionRewardCards,
      grantAlchemistReward: shouldGrantAlchemistReward(
        getActiveRewardModifiersForContentSystem(deps.run.contentSystemType, deps.activeLabyrinthRewardModifiers),
      ),
    });

    useHomesteadStore.getState().addMaterials(result.materials);
    applyFinalizedRewards(result);
    useUiStore.getState().clearCardHover();
    routeAfterReward(result.route, result.materials, result.nextRewardState, result.clearCompanionRewardCards);
  }

  function handleDestinationChoice(destination: Destination) {
    const selectedBossId =
      destination === CONSTANTS.DESTINATIONS.BOSS_COMBAT ? readRunSessionStore().rewardState.selectedBossId : null;
    deps.run.setCompletedDestinations((prev) => [...prev, destination]);
    deps.run.setDestinationIndexInAct((p) => p + 1);
    useUiStore.getState().clearCardHover();
    routeDestinationChoice(destination, {
      navigateTo: deps.navigateTo,
      beginMysteryEvent: deps.beginMysteryEvent,
      resetCorruption: () => setCorruptionResult(null),
      startShop: deps.onInitShop,
      startAlchemist: deps.onInitAlchemist,
      startBattle: (enemyType) => deps.onStartBattle(undefined, undefined, enemyType),
      startBossBattle: () => {
        if (selectedBossId && deps.onStartBossById(selectedBossId)) return;
        deps.onStartBossBattle();
      },
    });
  }

  function endLabyrinthRun() {
    if (deps.run.contentSystemType !== CONSTANTS.CONTENT_SYSTEMS.LABYRINTH) return;
    applyRunDefeatTeardown({
      awardRunEndMaterials,
      finalizeRunXP: deps.talents.finalizeRunXP,
      clearCombatState,
    });
    transitionScreenImmediate(CONSTANTS.SCREENS.GAME_OVER, { immediate: true });
  }

  function handleActComplete(displayMaterials?: MaterialInventory) {
    useUiStore.getState().clearCardHover();
    deps.setHasActiveBattle(false);

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
    deps.navigateTo(CONSTANTS.SCREENS.DESTINATION, () => {
      setRewardState(deps.contentNav.createInitialDestinations({ destinationIndexInAct: 0 }));
      prepareDestinationScreen();
    });
  }

  function completeRunVictory(displayMaterials: MaterialInventory | null = null, onRenderedScreenCommit?: () => void) {
    deps.setHasActiveBattle(false);
    finalizeRunEndSession({
      awardRunEndMaterials,
      finalizeRunXP: deps.talents.finalizeRunXP,
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
    const prevDest = getPreviousDestination(deps.run.destinationIndexInAct, deps.run.completedDestinations);
    useUiStore.getState().clearCardHover();
    deps.clearMysteryCardChoices();
    deps.navigateTo(CONSTANTS.SCREENS.DESTINATION, () => {
      setRewardState(deps.contentNav.createInitialDestinations(undefined, prevDest));
      prepareDestinationScreen();
    });
  }

  function prepareDestinationScreen() {
    const state = readRunSessionStore().rewardState;
    const bossOnly = state.destinations.length === 1 && state.destinations[0] === CONSTANTS.DESTINATIONS.BOSS_COMBAT;
    if (!bossOnly) return;
    if (state.selectedBossId && getBossById(state.selectedBossId)) return;
    setRewardState((prev) => ({ ...prev, selectedBossId: getBossEnemy().id }));
  }

  function selectRewardChoice(id: string) {
    setRewardState((prev) => ({ ...prev, selectedId: id }));
  }

  function handleCampfireContinue() {
    const healFraction = CAMPFIRE_HEAL_FRACTION + deps.talents.talentEffects.campfireHealBonus;
    deps.run.setRunPlayerHealth((prev) =>
      Math.min(deps.run.runMaxHealth, prev + Math.floor(deps.run.runMaxHealth * healFraction)),
    );
    advanceToNextDestination();
  }

  return {
    clearCombatState,
    awardRunEndMaterials,
    computeVictoryResult,
    commitVictoryResult,
    handleBattleVictory,
    handleBattleDefeat,
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
