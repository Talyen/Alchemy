import {
  readActiveRun,
  readBattle,
  readRunProfile,
  readRunSession,
} from "@/features/alchemy/shared/stores/run-session-read-port";
import {
  addRunGold,
  awardMaterialsDuringRun,
  bindRunRandomSource,
  setDestinationOfferState,
  setRunMaxHealth,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { dispatchRunSessionCommand, type GameplayDraft } from "@/features/alchemy/shared/stores/run-session-command";
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
  function computeVictoryResult(draft?: GameplayDraft) {
    const runState = draft?.run.activeRun ?? readActiveRun();
    const runProfile = draft?.runProfile ?? readRunProfile();
    const battleState = draft?.battle.battleState ?? readBattle().battleState;
    const rewardTraits = draft
      ? runState.contentSystemType === CONSTANTS.CONTENT_SYSTEMS.WILDWOOD
        ? (draft.session.wildwoodDraft?.currentRewardTraitIds ?? [])
        : draft.session.activeLabyrinthRewardModifiers
      : getActiveRewardTraits(runState.contentSystemType);
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
        bossEnemyId: getBossEnemy([], draft ? bindRunRandomSource(deps.worldRng, draft) : deps.worldRng).id,
        destinationOfferState: {
          lastOfferedDestinations: runState.lastOfferedDestinations,
          roundsSinceOffered: runState.destinationRoundsSinceOffered,
        },
      },
      draft ? bindRunRandomSource(deps.rewardRng, draft) : deps.rewardRng,
      draft ? bindRunRandomSource(deps.destinationRng, draft) : deps.destinationRng,
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
          bindRunRandomSource(deps.rewardRng, draft),
          draft,
        );
        if (runState.contentSystemType === CONSTANTS.CONTENT_SYSTEMS.WILDWOOD) {
          deps.actions.commitWildwoodVictory(draft, committedResult);
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
