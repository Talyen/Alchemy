import { rollFreshBossId } from "@/features/alchemy/shared/config";
import { defaultGameSession } from "@/features/alchemy/shared/stores/default-game-session";
import { type GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import { resolveDraftLootProgress } from "@/features/alchemy/shared/stores/loot-progress";
import { syncBattleToRun } from "@/features/alchemy/shared/stores/run-lifecycle";
import {
  acceptCommand,
  dispatchRunSessionCommand,
  rejectCommand,
  snapshotTransactionValue,
  type RunTransaction,
} from "@/features/alchemy/shared/stores/run-session-command";
import {
  addRunGoldEarned,
  completeRunRoom,
  createDraftInstanceIdSource,
  createDraftRunRandomSource,
  enterWildwoodVictory,
  setDestinationOfferState,
  setGold,
  setRunMaxHealth,
  settleBattleVictory,
  settlePendingBattleMaterials,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { isPlayerDefeated, type BattleSnapshot } from "@/lib/battle";
import type { ContentSystemId } from "@/lib/content-systems/types";
import { CONTENT_SYSTEMS } from "@/lib/content-systems/types";
import { getOwnedUniqueDefinitionIds } from "@/lib/gear";
import { getCompanionCardChoices } from "../navigation/reward-flow";
import { shouldGrantCompanionReward } from "../navigation/reward-math";
import type { VictoryRewardsResult } from "../navigation/victory-flow";
import { computeVictoryRewards } from "../navigation/victory-flow";
import type { RunOutcomeDeps } from "./run-flow";

export interface CommitVictoryRewardsDeps {
  battleState: BattleSnapshot;
  contentSystemType: ContentSystemId;
}

export function commitVictoryRewards(
  draft: RunTransaction,
  result: VictoryRewardsResult,
  deps: CommitVictoryRewardsDeps,
  rng: () => number,
): boolean {
  settlePendingBattleMaterials(draft);

  completeRunRoom(draft);
  addRunGoldEarned(draft, Math.max(0, result.persistedGold - draft.runProfile.gold));
  setGold(draft, result.persistedGold);
  if (result.maxHealthDelta > 0) {
    setRunMaxHealth(draft, (prev) => prev + result.maxHealthDelta);
  }
  syncBattleToRun(draft, { playerHealth: result.playerHealth });

  setDestinationOfferState(draft, result.destinationOfferState);
  settleBattleVictory(
    draft,
    {
      ...result.rewardState,
      lastVictoryEnemyType: deps.battleState.currentEnemy.enemyType,
      lastVictoryContentSystem: deps.contentSystemType,
    },
    shouldGrantCompanionReward(result.labyrinthRewardModifiers)
      ? getCompanionCardChoices(rng, result.labyrinthRewardModifiers)
      : null,
  );
  return result.goldEarned > 0;
}

export function createVictoryCommand(
  getAvailableDestinations: RunOutcomeDeps["getAvailableDestinations"],
  gameSession: GameSession = defaultGameSession,
) {
  function computeVictoryResult(draft: RunTransaction) {
    const runState = draft.run.activeRun;
    const runProfile = draft.runProfile;
    if (draft.session.activity.kind !== "battle") throw new Error("Victory requires an active battle");
    const battleState = snapshotTransactionValue(draft.session.activity.data.battleState);
    const rewardTraits =
      runState.contentSystemType === CONTENT_SYSTEMS.WILDWOOD
        ? (draft.session.wildwoodDraft?.currentRewardTraitIds ?? [])
        : draft.session.activeLabyrinthRewardModifiers;
    return computeVictoryRewards(
      {
        lootProgress: resolveDraftLootProgress(draft),
        createInstanceId: createDraftInstanceIdSource(draft),
        characterId: runState.characterId,
        selectedDifficulty: runState.selectedDifficulty,
        unlockedTalents: snapshotTransactionValue(runProfile.unlockedTalents),
        runDeck: snapshotTransactionValue(runState.runDeck),
        runBoons: snapshotTransactionValue(runState.runBoons),
        equippedTrinketId: draft.gear.equippedTrinkets[runState.characterId],
        ownedTrinketIds: [...draft.gear.ownedTrinketIds],
        ownedUniqueIds: getOwnedUniqueDefinitionIds(snapshotTransactionValue(draft.gear.inventories)),
        contentSystemType: runState.contentSystemType,
        activeLabyrinthRewardModifiers: snapshotTransactionValue(rewardTraits),
        battleState,
        purseGold: draft.runProfile.gold,
        runMaxHealth: runState.runMaxHealth,
        destinationIndexInAct: runState.destinationIndexInAct,
        homesteadEffects: runProfile.effects,
        getAvailableDestinations: getAvailableDestinations,
        rollBossEnemyId: () => rollFreshBossId(createDraftRunRandomSource(draft, "world")),
        destinationOfferState: {
          lastOfferedDestinations: snapshotTransactionValue(runState.lastOfferedDestinations),
          roundsSinceOffered: runState.destinationRoundsSinceOffered,
        },
      },
      createDraftRunRandomSource(draft, "rewards"),
      createDraftRunRandomSource(draft, "destinations"),
    );
  }

  function commitVictoryResult() {
    return dispatchRunSessionCommand(
      (draft) => {
        if (draft.session.activity.kind !== "battle") return rejectCommand("There is no active battle to finish", null);
        const state = draft.session.activity.data.battleState;
        if (state.enemyHealth > 0 || isPlayerDefeated(state)) return rejectCommand("Battle has not been won", null);
        const committedResult = computeVictoryResult(draft);
        const battleState = snapshotTransactionValue(draft.session.activity.data.battleState);
        const runState = draft.run.activeRun;
        const goldGained = commitVictoryRewards(
          draft,
          committedResult,
          {
            battleState,
            contentSystemType: runState.contentSystemType,
          },
          createDraftRunRandomSource(draft, "rewards"),
        );
        if (runState.contentSystemType === CONTENT_SYSTEMS.WILDWOOD) {
          enterWildwoodVictory(draft);
        }
        return acceptCommand(goldGained);
      },
      undefined,
      gameSession,
    );
  }

  return commitVictoryResult;
}
