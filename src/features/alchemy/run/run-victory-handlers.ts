// Battle victory/defeat teardown and end-of-run material awards.
import type { RefObject } from "react";
import { TimerGroup } from "@/lib/animation/game-timer";
import { useRunStore } from "../stores/run-store";
import { useBattleStore } from "../stores/battle-store";
import { useHomesteadStore } from "../stores/homestead-store";
import { useScreenStore } from "../stores/screen-store";
import { playVictory, stopAllSfx } from "@/lib/audio";
import { getEndOfRunMaterials, applyMaterialFindBonus } from "@/lib/homestead/loot";
import { addInventory } from "@/lib/homestead/inventory";
import type { MaterialInventory } from "@/lib/homestead/types";
import { VICTORY_TRANSITION_DELAY } from "@/lib/game-constants";
import { getBossEnemy } from "../config";
import { computeVictoryRewards, commitVictoryRewards } from "../navigation/victory-flow";
import { applyRunDefeatTeardown } from "../navigation/run-navigation-helpers";
import { CONSTANTS, type Destination, type Screen } from "../types";
import type { TalentStateController } from "../use-talent-state";

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
  const getStore = () => useScreenStore.getState();

  function clearCombatState() {
    useBattleStore.getState().setHasActiveBattle(false);
    getStore().clearCardHover();
  }

  function awardRunEndMaterials(displayMaterials: MaterialInventory | null = null) {
    const runState = useRunStore.getState();
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
    getStore().setRunEndMaterials(displayMaterials ? addInventory(displayMaterials, mats) : mats);
    return mats;
  }

  function computeVictoryResult() {
    const runState = useRunStore.getState();
    const lobby = useHomesteadStore.getState();
    return computeVictoryRewards({
      characterId: runState.characterId,
      selectedDifficulty: runState.selectedDifficulty,
      unlockedTalents: runState.unlockedTalents,
      runDeck: runState.runDeck,
      runTrinkets: runState.runTrinkets,
      contentSystemType: runState.contentSystemType,
      activeLabyrinthRewardModifiers: getStore().activeLabyrinthRewardModifiers,
      battleState: useBattleStore.getState().logicalBattleState,
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
    const battleState = useBattleStore.getState().logicalBattleState;
    const runState = useRunStore.getState();
    const screenStore = getStore();

    commitVictoryRewards(result, {
      battleState,
      addHomesteadMaterials: (materials) => useHomesteadStore.getState().addMaterials(materials),
      addRunGold: runState.addRunGold,
      setRunPlayerHealth: runState.setRunPlayerHealth,
      setRunMaxHealth: runState.setRunMaxHealth,
      setRewardState: screenStore.setRewardState,
      setCompanionRewardCards: screenStore.setCompanionRewardCards,
      clearCombatState,
    });
  }

  function handleBattleVictory() {
    deps.rewardTransitionTimer.current.clearAll();
    commitVictoryResult(computeVictoryResult());
    stopAllSfx();
    playVictory();
    deps.rewardTransitionTimer.current.setTimeout(() => {
      if (getStore().hasActiveRun) {
        deps.setScreen(CONSTANTS.SCREENS.REWARDS);
      }
    }, VICTORY_TRANSITION_DELAY);
  }

  function handleBattleDefeat() {
    deps.rewardTransitionTimer.current.clearAll();
    const runState = useRunStore.getState();
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
