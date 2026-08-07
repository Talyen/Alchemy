import {
  readActiveRun,
  readBattle,
  readRunProfile,
  readRunSession,
} from "@/features/alchemy/shared/stores/run-session-read-port";
import {
  addRunGold,
  awardMaterialsDuringRun,
  setDestinationOfferState,
  setRunMaxHealth,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import {
  setCompanionRewardCards,
  setHasActiveBattle,
  setRewardState,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { playGoldGain, playVictory, stopAllSfx } from "@/lib/audio";
import { VICTORY_TRANSITION_DELAY } from "@/lib/game-constants";
import { getBossEnemy } from "@/features/alchemy/shared/config";
import { computeVictoryRewards, commitVictoryRewards } from "../navigation/victory-flow";
import { CONSTANTS } from "../../shared/types";
import { getActiveRewardTraits } from "./run-flow-handler-deps";
import type { RunFlowHandlerDeps } from "./run-flow-handler-deps";
import { clearCombatPresentation } from "./run-flow-session-helpers";

export function createVictoryHandlers(deps: RunFlowHandlerDeps) {
  function computeVictoryResult() {
    const runState = readActiveRun();
    return computeVictoryRewards(
      {
        characterId: runState.characterId,
        selectedDifficulty: runState.selectedDifficulty,
        unlockedTalents: readRunProfile().unlockedTalents,
        runDeck: runState.runDeck,
        runTrinkets: runState.runTrinkets,
        contentSystemType: runState.contentSystemType,
        activeLabyrinthRewardModifiers: getActiveRewardTraits(runState.contentSystemType),
        battleState: readBattle().battleState,
        runGold: runState.runGold,
        runPlayerHealth: runState.runPlayerHealth,
        runMaxHealth: runState.runMaxHealth,
        destinationIndexInAct: runState.destinationIndexInAct,
        completedDestinations: runState.completedDestinations,
        homesteadEffects: readRunProfile().effects,
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

  function commitVictoryResult() {
    let goldGained = false;
    dispatchRunSessionCommand(
      () => {
        const committedResult = computeVictoryResult();
        const battleState = readBattle().battleState;
        const runState = readActiveRun();
        goldGained = commitVictoryRewards(
          committedResult,
          {
            battleState,
            contentSystemType: runState.contentSystemType,
            addHomesteadMaterials: awardMaterialsDuringRun,
            addRunGold,
            setRunMaxHealth,
            setRewardState,
            setCompanionRewardCards,
            setDestinationOfferState,
            setHasActiveBattle,
          },
          deps.rewardRng,
        );
        if (runState.contentSystemType === CONSTANTS.CONTENT_SYSTEMS.WILDWOOD) {
          deps.actions.commitWildwoodVictory(committedResult);
        }
      },
      {
        afterCommit: () => {
          if (goldGained) playGoldGain();
          clearCombatPresentation();
        },
      },
    );
  }

  function handleBattleVictory() {
    // Compute random rewards and commit their state in one transaction so RNG
    // counters cannot advance independently of the resulting reward state.
    commitVictoryResult();
    stopAllSfx();
    playVictory();
    if (readRunSession().hasActiveRun) {
      const nextScreen =
        readActiveRun().contentSystemType === CONSTANTS.CONTENT_SYSTEMS.WILDWOOD
          ? CONSTANTS.SCREENS.WILDWOOD_RECOVERY
          : CONSTANTS.SCREENS.REWARDS;
      deps.actions.transition(nextScreen, {
        delayMs: VICTORY_TRANSITION_DELAY,
        guard: () => readRunSession().hasActiveRun,
      });
    }
  }

  return {
    commitVictoryResult,
    handleBattleVictory,
  };
}
