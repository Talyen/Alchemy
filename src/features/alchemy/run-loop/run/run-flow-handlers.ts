// Unified run-flow handlers: battle victory/defeat, rewards, destinations, and run completion.
import type { BattleCard, CharacterId, DifficultyId, DifficultyModifier } from "@/lib/game-data";
import type { EncounterRewardTraitId } from "@/lib/content-systems/encounter-traits";
import {
  readActiveRunStore,
  readBattleStore,
  readRunSessionStore,
  awardMaterialsDuringRun,
} from "../../shared/stores/run-session-facade";
import { useHomesteadStore } from "../../shared/stores/homestead-store";
import {
  setCompanionRewardCards,
  setCorruptionResult,
  setRewardState,
  setRunEndMaterials,
} from "../../shared/stores/run-session-facade";
import { useUiStore } from "../../shared/stores/ui-store";
import { playUISound, playVictory, stopAllSfx } from "@/lib/audio";
import { applyEndOfRunHomesteadBonuses } from "@/lib/homestead/loot";
import { addInventory, emptyInventory } from "@/lib/homestead/inventory";
import type { MaterialInventory } from "@/lib/homestead/types";
import { ACTS_PER_RUN, CAMPFIRE_HEAL_FRACTION, VICTORY_TRANSITION_DELAY } from "@/lib/game-constants";
import { getBossEnemy, getBossById } from "@/features/alchemy/shared/config";
import { computeVictoryRewards, commitVictoryRewards, type VictoryRewardsResult } from "../navigation/victory-flow";
import {
  finalizeRewardState,
  getActiveRewardModifiersForContentSystem,
  shouldGrantAlchemistReward,
  executeRewardRouteTransition,
} from "../navigation/reward-flow";
import {
  applyRunDefeatTeardown,
  clearBattleUi,
  finalizeRunEndSession,
} from "@/features/alchemy/shared/stores/run-transitions";
import type { ScreenTransitionOptions } from "@/features/alchemy/shell/use-screen-transitions";
import { applyAlchemistPotion, applyRewardSelection, routeDestinationChoice } from "./run-destination-handlers";
import type { ContentSystemNavigationApi } from "@/features/alchemy/run-setup/run/content-system-navigation";
import { CONSTANTS, type Destination, type Screen } from "../../shared/types";
import type { RunStateController, TalentStateController } from "../../shared/stores/run-session-facade";

export interface RunFlowHandlerDeps {
  run: RunStateController;
  talents: TalentStateController;
  navigateTo: (nextScreen: Screen, onRenderedScreenCommit?: () => void) => void;
  transition: (nextScreen: Screen, options?: ScreenTransitionOptions) => void;
  onLabyrinthFailNode: () => void;
  onLabyrinthClearNode: () => void;
  onInitShop: () => void;
  onInitAlchemist: () => void;
  onInitTrinketShop: () => void;
  onInitEquipmentShop: () => void;
  onStartBattle: (deck?: BattleCard[], gold?: number, enemyType?: "normal" | "elite") => void;
  onStartBossBattle: () => void;
  onStartBossById: (bossId: string, modifiers?: DifficultyModifier[]) => boolean;
  onMarkDifficultyCompleted: (characterId: CharacterId, difficultyId: DifficultyId) => void;
  onCommitWildwoodVictory: (result: VictoryRewardsResult) => void;
  contentNav: Pick<ContentSystemNavigationApi, "createInitialDestinations">;
  getAvailableDestinations: (options?: {
    currentHealth?: number;
    currentGold?: number;
    destinationIndexInAct?: number;
    maxHealth?: number;
  }) => Destination[];
  beginMysteryEvent: () => void;
  clearMysteryCardChoices: () => void;
  onWildwoodRewardComplete: () => void;
}

function getActiveRewardTraits(contentSystemType: RunStateController["contentSystemType"]): EncounterRewardTraitId[] {
  const session = readRunSessionStore();
  if (contentSystemType === CONSTANTS.CONTENT_SYSTEMS.WILDWOOD) {
    return session.wildwoodDraft?.currentRewardTraitIds ?? [];
  }
  return session.activeLabyrinthRewardModifiers as EncounterRewardTraitId[];
}

export function createRunFlowHandlers(deps: RunFlowHandlerDeps) {
  function clearCombatState() {
    readBattleStore().setHasActiveBattle(false);
    useUiStore.getState().clearCardHover();
  }

  function awardRunEndMaterials() {
    const runState = readActiveRunStore();
    if (runState.contentSystemType === CONSTANTS.CONTENT_SYSTEMS.WILDWOOD) {
      runState.clearRunMaterialsEarned();
      const none = emptyInventory();
      setRunEndMaterials(none);
      return none;
    }
    const homesteadEffects = useHomesteadStore.getState().effects;
    const runCollected = runState.runMaterialsEarned;
    const homesteadBonus = applyEndOfRunHomesteadBonuses(emptyInventory(), homesteadEffects, runState.roomsEncountered);
    useHomesteadStore.getState().addMaterials(homesteadBonus);
    setRunEndMaterials(addInventory(runCollected, homesteadBonus));
    runState.clearRunMaterialsEarned();
    return homesteadBonus;
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
      activeLabyrinthRewardModifiers: getActiveRewardTraits(runState.contentSystemType),
      battleState: readBattleStore().battleState,
      runGold: runState.runGold,
      runPlayerHealth: runState.runPlayerHealth,
      runMaxHealth: runState.runMaxHealth,
      destinationIndexInAct: runState.destinationIndexInAct,
      completedDestinations: runState.completedDestinations,
      homesteadEffects: lobby.effects,
      getAvailableDestinations: deps.getAvailableDestinations,
      bossEnemyId: getBossEnemy().id,
      destinationOfferState: {
        lastOfferedDestinations: runState.lastOfferedDestinations,
        roundsSinceOffered: runState.destinationRoundsSinceOffered,
      },
    });
  }

  function commitVictoryResult(result: VictoryRewardsResult) {
    const battleState = readBattleStore().battleState;
    const runState = readActiveRunStore();
    commitVictoryRewards(result, {
      battleState,
      contentSystemType: runState.contentSystemType,
      addHomesteadMaterials: awardMaterialsDuringRun,
      addRunGold: runState.addRunGold,
      setRunMaxHealth: runState.setRunMaxHealth,
      setRewardState,
      setCompanionRewardCards,
      setDestinationOfferState: runState.setDestinationOfferState,
      clearCombatState,
    });
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
      finalizeRunXP: deps.talents.finalizeRunXP,
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
    useUiStore.getState().clearCardHover();
    deps.clearMysteryCardChoices();
    prepareNextDestination();
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

  function finishRewards() {
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
      applyAlchemistPotion({ setRunDeck: deps.run.setRunDeck });
    }

    useUiStore.getState().clearCardHover();
    if (isWildwood && result.route !== CONSTANTS.REWARD_ROUTES.COMPANION_REWARD) {
      setRewardState(result.nextRewardState);
      deps.onWildwoodRewardComplete();
      return;
    }
    executeRewardRouteTransition(
      result.route,
      result.materials,
      result.nextRewardState,
      result.clearCompanionRewardCards,
      {
        navigateTo: deps.navigateTo,
        completeRunVictory,
        handleActComplete,
        onLabyrinthClearNode: deps.onLabyrinthClearNode,
        setCompanionRewardCards,
        setRewardState,
      },
    );
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
      startTrinketShop: deps.onInitTrinketShop,
      startEquipmentShop: deps.onInitEquipmentShop,
      startBattle: (enemyType) => deps.onStartBattle(undefined, undefined, enemyType),
      startBossBattle: () => {
        if (selectedBossId && deps.onStartBossById(selectedBossId)) return;
        deps.onStartBossBattle();
      },
    });
  }

  function endLabyrinthRun() {
    if (deps.run.contentSystemType !== CONSTANTS.CONTENT_SYSTEMS.LABYRINTH) return;
    endRunAndShowGameOver();
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
