import { readActiveRun, readRunSession } from "@/features/alchemy/shared/stores/run-session-read-port";
import { createDraftRunRandomSource } from "@/features/alchemy/shared/stores/run-session-write-port";
import { dispatchRunSessionCommand, type GameplayDraft } from "@/features/alchemy/shared/stores/run-session-command";
import { playGoldGain, playVictory, stopAllSfx } from "@/lib/audio";
import { VICTORY_TRANSITION_DELAY } from "@/lib/game-constants";
import { getBossEnemy } from "@/features/alchemy/shared/config";
import { computeVictoryRewards, commitVictoryRewards } from "../navigation/victory-flow";
import { CONSTANTS } from "../../shared/types";
import type { RunFlowHandlerDeps } from "./run-flow-handler-deps";
import { useUiStore } from "../../shared/stores/ui-store";

export function createVictoryHandlers(deps: RunFlowHandlerDeps) {
  function computeVictoryResult(draft: GameplayDraft) {
    const runState = draft.run.activeRun;
    const runProfile = draft.runProfile;
    const battleState = draft.battle.battleState;
    const rewardTraits =
      runState.contentSystemType === CONSTANTS.CONTENT_SYSTEMS.WILDWOOD
        ? (draft.session.wildwoodDraft?.currentRewardTraitIds ?? [])
        : draft.session.activeLabyrinthRewardModifiers;
    return computeVictoryRewards(
      {
        characterId: runState.characterId,
        selectedDifficulty: runState.selectedDifficulty,
        unlockedTalents: runProfile.unlockedTalents,
        runDeck: runState.runDeck,
        runTrinkets: runState.runTrinkets,
        contentSystemType: runState.contentSystemType,
        activeLabyrinthRewardModifiers: rewardTraits,
        battleState,
        runGold: runState.runGold,
        runPlayerHealth: runState.runPlayerHealth,
        runMaxHealth: runState.runMaxHealth,
        destinationIndexInAct: runState.destinationIndexInAct,
        completedDestinations: runState.completedDestinations,
        homesteadEffects: runProfile.effects,
        getAvailableDestinations: deps.getAvailableDestinations,
        bossEnemyId: getBossEnemy([], createDraftRunRandomSource(draft, "world")).id,
        destinationOfferState: {
          lastOfferedDestinations: runState.lastOfferedDestinations,
          roundsSinceOffered: runState.destinationRoundsSinceOffered,
        },
      },
      createDraftRunRandomSource(draft, "rewards"),
      createDraftRunRandomSource(draft, "destinations"),
    );
  }

  function commitVictoryResult() {
    let goldGained = false;
    dispatchRunSessionCommand(
      (draft) => {
        const committedResult = computeVictoryResult(draft);
        const battleState = draft.battle.battleState;
        const runState = draft.run.activeRun;
        goldGained = commitVictoryRewards(
          draft,
          committedResult,
          {
            battleState,
            contentSystemType: runState.contentSystemType,
          },
          createDraftRunRandomSource(draft, "rewards"),
        );
        if (runState.contentSystemType === CONSTANTS.CONTENT_SYSTEMS.WILDWOOD) {
          deps.actions.commitWildwoodVictory(draft, committedResult);
        }
      },
      {
        afterCommit: () => {
          if (goldGained) playGoldGain();
          // Hover only — full VFX reset waits until the battle screen unmounts so
          // kill animations can play through victory grace.
          useUiStore.getState().clearCardHover();
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
