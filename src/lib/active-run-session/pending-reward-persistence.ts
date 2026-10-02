import { cardById, trinketById, type BattleCard } from "@/lib/game-data";
import { logError } from "@/lib/error-logger";
import { filterValidDestinations } from "@/lib/routing";
import type { PersistedPendingReward } from "./types";
import type { PendingRewardSharedFields, RewardState } from "./reward-types";

type SharedRewardFields = Omit<PendingRewardSharedFields, "companionChoiceIds">;

function resolveCatalogChoices<T>(
  choiceIds: readonly string[],
  catalog: Record<string, T | undefined>,
  logContext: string,
): T[] {
  const valid: T[] = [];
  const droppedIds: string[] = [];
  for (const id of choiceIds) {
    const entry = Object.hasOwn(catalog, id) ? catalog[id] : undefined;
    if (entry) valid.push(entry);
    else droppedIds.push(id);
  }
  if (droppedIds.length > 0) {
    logError(`Dropped invalid pending ${logContext} choices`, "storage", { droppedIds });
  }
  return valid;
}

function hasSharedRewardValue(state: SharedRewardFields): boolean {
  // selectedId is deliberately excluded: the store only sets it at claim time
  // alongside its choices (see claimRunReward), so a selection always travels
  // with resolvable choices. A lone selectedId with nothing else is stale, not
  // resumable, and must not keep an empty reward alive.
  return (
    state.gold > 0 ||
    Object.values(state.materials).some((amount) => amount > 0) ||
    state.destinations.length > 0 ||
    state.selectedBossId !== null ||
    state.lastVictoryEnemyType !== null ||
    state.lastVictoryContentSystem !== null
  );
}

function sharedRewardFields(rewardState: SharedRewardFields): SharedRewardFields {
  return {
    selectedId: rewardState.selectedId,
    gold: rewardState.gold,
    materials: rewardState.materials,
    destinations: [...rewardState.destinations],
    selectedBossId: rewardState.selectedBossId,
    lastVictoryEnemyType: rewardState.lastVictoryEnemyType,
    lastVictoryContentSystem: rewardState.lastVictoryContentSystem,
  };
}

export function serializePendingReward(
  rewardState: RewardState,
  companionRewardCards: BattleCard[] | null = null,
): PersistedPendingReward | null {
  if (!rewardState.choices.length && !companionRewardCards?.length && !hasSharedRewardValue(rewardState)) {
    return null;
  }

  const shared = {
    ...sharedRewardFields(rewardState),
    companionChoiceIds: companionRewardCards?.map((choice) => choice.id) ?? [],
  };
  if (rewardState.rewardType === "gear") {
    return { ...shared, rewardType: "gear", gearChoices: rewardState.choices };
  }
  return {
    ...shared,
    rewardType: rewardState.rewardType,
    choiceIds: rewardState.choices.map((choice) => choice.id),
  };
}

function restoreRewardState(persisted: PersistedPendingReward): RewardState {
  const shared = {
    ...sharedRewardFields(persisted),
    destinations: filterValidDestinations(persisted.destinations),
    companionChoiceIds: [],
  };

  if (persisted.rewardType === "gear") {
    return { ...shared, rewardType: "gear", choices: persisted.gearChoices };
  }

  if (persisted.rewardType === "card") {
    return { ...shared, rewardType: "card", choices: resolveCatalogChoices(persisted.choiceIds, cardById, "card") };
  }

  return {
    ...shared,
    rewardType: persisted.rewardType,
    choices: resolveCatalogChoices(persisted.choiceIds, trinketById, "trinket/boon"),
  };
}

function retainPendingReward(state: RewardState): RewardState | null {
  return state.choices.length > 0 || hasSharedRewardValue(state) ? state : null;
}

export function restorePendingReward(persisted: PersistedPendingReward): RewardState | null {
  return retainPendingReward(restoreRewardState(persisted));
}

export interface RestoredPendingReward {
  rewardState: RewardState | null;
  companionRewardCards: BattleCard[] | null;
}

export function restorePendingRewardBundle(persisted: PersistedPendingReward): RestoredPendingReward {
  const companions = resolveCatalogChoices(persisted.companionChoiceIds, cardById, "companion");
  const restored = restoreRewardState(persisted);

  return {
    // Bonus-only bundles still need a primary shell so the reward flow can
    // advance to them. Preserve the empty Card reward used by that flow.
    rewardState:
      retainPendingReward(restored) ?? (companions.length ? { ...restored, rewardType: "card", choices: [] } : null),
    companionRewardCards: companions.length ? companions : null,
  };
}
