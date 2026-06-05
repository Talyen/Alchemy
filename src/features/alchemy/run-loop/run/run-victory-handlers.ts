// Battle victory/defeat teardown and end-of-run material awards.
import type { RefObject } from "react";
import { TimerGroup } from "@/lib/animation/game-timer";
import { readActiveRunStore, readBattleStore, readRunSessionStore } from "../../shared/stores/run-session-facade";
import { useHomesteadStore } from "../../shared/stores/homestead-store";
import { setCompanionRewardCards, setRewardState, setRunEndMaterials } from "../../shared/stores/run-session-facade";
import { useUiStore } from "../../shared/stores/ui-store";
import { playVictory, stopAllSfx } from "@/lib/audio";
import { getEndOfRunMaterials, applyMaterialFindBonus } from "@/lib/homestead/loot";
import { addInventory } from "@/lib/homestead/inventory";
import type { MaterialInventory } from "@/lib/homestead/types";
import { VICTORY_TRANSITION_DELAY } from "@/lib/game-constants";
import { getBossEnemy } from "@/features/alchemy/shared/config";
import { computeVictoryRewards, commitVictoryRewards } from "../navigation/victory-flow";
import { applyRunDefeatTeardown } from "../navigation/run-navigation-helpers";
import { CONSTANTS, type Destination, type Screen } from "../../shared/types";
import type { TalentStateController } from "../../shared/stores/run-session-facade";

type GetAvailableDestinations = (options?: {
  currentHealth?: number;
  currentGold?: number;
  destinationIndexInAct?: number;
  maxHealth?: number;
}) => Destination[];

export type RunVictoryHandlerDeps = {
  rewardTransitionTimer: RefObject<TimerGroup>;
  setScreen: React.Dispatch<React.SetStateAction<Screen>>;
  navigateTo: (nextScreen: Screen, onRenderedScreenCommit?: () => void) => void;
  onLabyrinthFailNode: () => void;
  getAvailableDestinations: GetAvailableDestinations;
  talents: TalentStateController;
};

export function createRunVictoryHandlers(deps: RunVictoryHandlerDeps) {
  function clearCombatState() {
    readBattleStore().setHasActiveBattle(false);
    useUiStore.getState().clearCardHover();
  }

  function awardRunEndMaterials(displayMaterials: MaterialInventory | null = null) {
    const runState = readActiveRunStore();
    const homesteadEffects = useHomesteadStore.getState().effects;
    const baseMats = getEndOfRunMaterials(runState.roomsEncountered, runState.currentAct);
    const baseHerbs = baseMats.herbs + (homesteadEffects.herbFindBonus > 0 ? runState.roomsEncountered : 0);
    const food = baseMats.food + (homesteadEffects.flatArrowDamage > 0 ? runState.roomsEncountered : 0);
    const combinedBase = {
      wood: baseMats.wood,
      iron: baseMats.iron,
      herbs: baseHerbs,
      food,
      crystal: baseMats.crystal,
    };
    const mats = applyMaterialFindBonus(combinedBase, homesteadEffects);
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
    deps.rewardTransitionTimer.current.setTimeout(() => {
      if (readRunSessionStore().hasActiveRun) {
        deps.setScreen(CONSTANTS.SCREENS.REWARDS);
      }
    }, VICTORY_TRANSITION_DELAY);
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
    deps.setScreen(CONSTANTS.SCREENS.GAME_OVER);
  }

  return {
    clearCombatState,
    awardRunEndMaterials,
    computeVictoryResult,
    commitVictoryResult,
    handleBattleVictory,
    handleBattleDefeat,
  };
}
