import {
  readActiveRun,
  readBattle,
  readRunProfile,
  readRunSession,
} from "@/features/alchemy/shared/stores/run-session-read-port";
import { awardMaterialsDuringRun } from "@/features/alchemy/shared/stores/run-session-write-port";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { setCompanionRewardCards, setRewardState } from "@/features/alchemy/shared/stores/run-session-write-port";
import { playGoldGain, playVictory, stopAllSfx } from "@/lib/audio";
import { VICTORY_TRANSITION_DELAY } from "@/lib/game-constants";
import { getBossEnemy } from "@/features/alchemy/shared/config";
import { computeVictoryRewards, commitVictoryRewards, type VictoryRewardsResult } from "../navigation/victory-flow";
import { CONSTANTS } from "../../shared/types";
import { getActiveRewardTraits } from "./run-flow-handler-deps";
import { clearCombatPresentation } from "./run-flow-session-helpers";
import type { RunFlowContext } from "./run-flow-context";

export function createVictoryHandlers(ctx: RunFlowContext) {
  const { deps } = ctx;

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

  function commitVictoryResult(result: VictoryRewardsResult) {
    let goldGained = false;
    dispatchRunSessionCommand(
      () => {
        const battleState = readBattle().battleState;
        const runState = readActiveRun();
        goldGained = commitVictoryRewards(
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
            setHasActiveBattle: (active) => readBattle().setHasActiveBattle(active),
          },
          deps.rewardRng,
        );
        if (runState.contentSystemType === CONSTANTS.CONTENT_SYSTEMS.WILDWOOD) {
          deps.dispatch({ type: "commit-wildwood-victory", result });
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
    commitVictoryResult(computeVictoryResult());
    stopAllSfx();
    playVictory();
    if (readRunSession().hasActiveRun) {
      const nextScreen =
        readActiveRun().contentSystemType === CONSTANTS.CONTENT_SYSTEMS.WILDWOOD
          ? CONSTANTS.SCREENS.WILDWOOD_RECOVERY
          : CONSTANTS.SCREENS.REWARDS;
      deps.dispatch({
        type: "transition",
        screen: nextScreen,
        options: {
          delayMs: VICTORY_TRANSITION_DELAY,
          guard: () => readRunSession().hasActiveRun,
        },
      });
    }
  }

  return {
    computeVictoryResult,
    commitVictoryResult,
    handleBattleVictory,
  };
}
