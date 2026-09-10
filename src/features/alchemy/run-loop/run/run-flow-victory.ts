import { resolveDraftLootProgress } from "@/features/alchemy/shared/stores/loot-progress";
import { readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { createDraftRunRandomSource } from "@/features/alchemy/shared/stores/run-session-write-port";
import { dispatchRunSessionCommand, type GameplayDraft } from "@/features/alchemy/shared/stores/run-session-command";
import { playGoldGain, playVictory, stopAllSfx } from "@/lib/audio";
import { resolveGameDelay } from "@/lib/animation/game-timer";
import { BATTLE_END_TRANSITION_DELAY } from "@/lib/game-constants";
import { rollFreshBossId } from "@/features/alchemy/shared/config";
import { computeVictoryRewards } from "../navigation/victory-flow";
import type { VictoryRewardsResult } from "../navigation/victory-flow";
import type { BattleState } from "@/lib/battle";
import type { ContentSystemId } from "@/lib/content-systems/types";
import { CONTENT_SYSTEMS } from "@/lib/content-systems/types";
import { getOwnedUniqueDefinitionIds } from "@/lib/gear";
import type { RunFlowHandlerDeps } from "./run-flow";
import {
  clearBattleUi,
  finalizeRunEndSession,
  syncBattleToRun,
} from "@/features/alchemy/shared/stores/run-session-lifecycle-port";
import {
  awardMaterialsDuringRun,
  setCompanionRewardCards,
  setDestinationOfferState,
  setHasActiveBattle,
  setGold,
  setRewardState,
  setRunMaxHealth,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { getCompanionCardChoices } from "../navigation/reward-flow";
import { shouldGrantCompanionReward } from "../navigation/reward-math";
import { finalizeRunXP } from "@/features/alchemy/shared/stores/run-session-write-port";
import { awardRunEndMaterials } from "./run-flow-defeat";
import { ROUTE_SCREENS } from "@/lib/routing";
import type { MaterialInventory } from "@/lib/homestead/types";
import { emptyInventory } from "@/lib/homestead/inventory";

export interface CommitVictoryRewardsDeps {
  battleState: BattleState;
  contentSystemType: ContentSystemId;
}

export function awardsRunMaterialsFor(contentSystemType: ContentSystemId): boolean {
  return contentSystemType !== CONTENT_SYSTEMS.WILDWOOD;
}

function hasAnyPendingMaterial(materials: MaterialInventory): boolean {
  return Object.values(materials).some((value) => value > 0);
}

export function commitVictoryRewards(
  draft: GameplayDraft,
  result: VictoryRewardsResult,
  deps: CommitVictoryRewardsDeps,
  rng: () => number,
): boolean {
  if (awardsRunMaterialsFor(deps.contentSystemType) && hasAnyPendingMaterial(deps.battleState.pendingMaterials)) {
    awardMaterialsDuringRun(draft, deps.battleState.pendingMaterials);
  }
  draft.battle.battleState.pendingMaterials = { ...emptyInventory() };

  setGold(draft, result.persistedGold);
  if (result.maxHealthDelta > 0) {
    setRunMaxHealth(draft, (prev) => prev + result.maxHealthDelta);
  }
  syncBattleToRun(draft, { playerHealth: result.playerHealth });

  setRewardState(draft, {
    ...result.rewardState,
    lastVictoryEnemyType: deps.battleState.currentEnemy.enemyType,
    lastVictoryContentSystem: deps.contentSystemType,
  });
  setDestinationOfferState(draft, result.destinationOfferState);
  if (shouldGrantCompanionReward(result.labyrinthRewardModifiers)) {
    setCompanionRewardCards(draft, getCompanionCardChoices(rng, result.labyrinthRewardModifiers));
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
        lootProgress: resolveDraftLootProgress(draft),
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
        purseGold: draft.runProfile.gold,
        runMaxHealth: runState.runMaxHealth,
        destinationIndexInAct: runState.destinationIndexInAct,
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

          deps.actions.clearCardHover();
        },
      },
    );
  }

  function handleBattleVictory() {
    commitVictoryResult();
    stopAllSfx();
    playVictory();
    if (readRunSession().hasActiveRun) {
      const nextScreen = ROUTE_SCREENS.REWARDS;
      deps.actions.transition(nextScreen, {
        delayMs: resolveGameDelay(BATTLE_END_TRANSITION_DELAY),
        guard: () => readRunSession().hasActiveRun,
      });
    }
  }

  function completeRunVictory(onRenderedScreenCommit?: () => void) {
    clearBattleUi();
    finalizeRunEndSession({
      awardRunEndMaterials,
      finalizeRunXP,
    });
    deps.actions.navigateTo(ROUTE_SCREENS.RUN_VICTORY, onRenderedScreenCommit);
  }

  return {
    commitVictoryResult,
    handleBattleVictory,
    completeRunVictory,
  };
}
