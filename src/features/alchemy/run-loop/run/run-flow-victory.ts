import { readRunSession } from "@/features/alchemy/shared/stores/run-session-read-port";
import { createDraftRunRandomSource } from "@/features/alchemy/shared/stores/run-session-write-port";
import { dispatchRunSessionCommand, type GameplayDraft } from "@/features/alchemy/shared/stores/run-session-command";
import { playGoldGain, playVictory, stopAllSfx } from "@/lib/audio";
import { resolveGameDelay } from "@/lib/animation/game-timer";
import { VICTORY_TRANSITION_DELAY } from "@/lib/game-constants";
import { rollFreshBossId } from "@/features/alchemy/shared/config";
import { computeVictoryRewards } from "../navigation/victory-flow";
import type { CommitVictoryRewardsDeps, VictoryRewardsResult } from "../navigation/victory-flow-types";
import { getOwnedUniqueDefinitionIds } from "@/lib/gear";
import type { RunFlowHandlerDeps } from "./run-flow-handler-deps";
import { syncBattleToRun } from "@/features/alchemy/shared/stores/run-session-lifecycle-port";
import {
  addRunGold,
  awardMaterialsDuringRun,
  setCompanionRewardCards,
  setDestinationOfferState,
  setHasActiveBattle,
  setRewardState,
  setRunMaxHealth,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { getCompanionCardChoices, shouldGrantCompanionReward } from "../navigation/reward-flow";
import { ROUTE_SCREENS } from "@/lib/routing";
import { CONTENT_SYSTEMS } from "@/lib/content-systems/types";

export type { CommitVictoryRewardsDeps };

export function commitVictoryRewards(
  draft: GameplayDraft,
  result: VictoryRewardsResult,
  deps: CommitVictoryRewardsDeps,
  rng: () => number,
): boolean {
  if (deps.contentSystemType !== CONTENT_SYSTEMS.WILDWOOD && deps.battleState.pendingMaterials.crystal > 0) {
    awardMaterialsDuringRun(draft, deps.battleState.pendingMaterials);
  }

  addRunGold(draft, result.goldEarned);
  syncBattleToRun(draft, { playerHealth: result.playerHealth });
  if (result.maxHealthDelta > 0) {
    setRunMaxHealth(draft, (prev) => prev + result.maxHealthDelta);
  }

  setRewardState(draft, {
    ...result.rewardState,
    lastVictoryEnemyType: deps.battleState.currentEnemy.enemyType,
    lastVictoryContentSystem: deps.contentSystemType,
  });
  setDestinationOfferState(draft, result.destinationOfferState);
  if (shouldGrantCompanionReward(result.labyrinthRewardModifiers)) {
    setCompanionRewardCards(draft, getCompanionCardChoices(rng));
  } else {
    setCompanionRewardCards(draft, null);
  }
  setHasActiveBattle(draft, false);
  return result.goldEarned > 0;
}

export function createVictoryHandlers(deps: RunFlowHandlerDeps) {
  function computeVictoryResult(draft: GameplayDraft) {
    const runState = draft.run.activeRun;
    const runProfile = draft.runProfile;
    const battleState = draft.battle.battleState;
    const rewardTraits =
      runState.contentSystemType === CONTENT_SYSTEMS.WILDWOOD
        ? (draft.session.wildwoodDraft?.currentRewardTraitIds ?? [])
        : draft.session.activeLabyrinthRewardModifiers;
    return computeVictoryRewards(
      {
        characterId: runState.characterId,
        selectedDifficulty: runState.selectedDifficulty,
        unlockedTalents: runProfile.unlockedTalents,
        runDeck: runState.runDeck,
        runBoons: runState.runBoons,
        equippedTrinketId: draft.gear.equippedTrinkets[runState.characterId],
        ownedTrinketIds: [...draft.gear.ownedTrinketIds],
        ownedUniqueIds: getOwnedUniqueDefinitionIds(draft.gear.inventories),
        contentSystemType: runState.contentSystemType,
        activeLabyrinthRewardModifiers: rewardTraits,
        battleState,
        runGold: draft.runProfile.gold,
        runPlayerHealth: runState.runPlayerHealth,
        runMaxHealth: runState.runMaxHealth,
        destinationIndexInAct: runState.destinationIndexInAct,
        completedDestinations: runState.completedDestinations,
        homesteadEffects: runProfile.effects,
        getAvailableDestinations: deps.getAvailableDestinations,
        bossEnemyId: rollFreshBossId(createDraftRunRandomSource(draft, "world")),
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
        if (runState.contentSystemType === CONTENT_SYSTEMS.WILDWOOD) {
          deps.actions.commitWildwoodVictory(draft, committedResult);
        }
      },
      {
        afterCommit: () => {
          if (goldGained) playGoldGain();
          // Hover only — full VFX reset waits until the battle screen unmounts so
          // kill animations can play through victory grace.
          deps.actions.clearCardHover();
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
      const nextScreen = ROUTE_SCREENS.REWARDS;
      deps.actions.transition(nextScreen, {
        delayMs: resolveGameDelay(VICTORY_TRANSITION_DELAY),
        guard: () => readRunSession().hasActiveRun,
      });
    }
  }

  return {
    commitVictoryResult,
    handleBattleVictory,
  };
}
