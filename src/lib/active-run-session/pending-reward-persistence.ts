import { cardById, trinketById, type BattleCard, type TrinketEntry } from "@/lib/game-data";
import { logError } from "@/lib/error-logger";
import { filterValidDestinations } from "@/lib/routing";
import type { PersistedPendingReward } from "./types";
import {
  createEmptyRewardState,
  type BoonRewardState,
  type CardRewardState,
  type GearRewardState,
  type PendingRewardSharedFields,
  type RewardState,
  type TrinketRewardState,
} from "./reward-types";

function nonEmptyChoicesOrNull<T>(choices: T[]): T[] | null {
  return choices.length === 0 ? null : choices;
}

interface ResolvedChoices<T> {
  valid: T[];
  droppedIds: string[];
}

function resolveCatalogChoicesWithDropped<T>(
  choiceIds: string[],
  catalog: Record<string, T | undefined>,
): ResolvedChoices<T> {
  const valid: T[] = [];
  const droppedIds: string[] = [];
  for (const id of choiceIds) {
    const entry = Object.hasOwn(catalog, id) ? catalog[id] : undefined;
    if (entry) valid.push(entry);
    else droppedIds.push(id);
  }
  return { valid, droppedIds };
}

function resolveCardChoices(choiceIds: string[]): BattleCard[] | null {
  const { valid, droppedIds } = resolveCatalogChoicesWithDropped(choiceIds, cardById);
  if (droppedIds.length > 0 && choiceIds.length > 0) {
    logError("Dropped invalid pending companion choices", "storage", { droppedIds });
  }
  return nonEmptyChoicesOrNull(valid);
}

function hasSharedRewardValue(state: RewardState): boolean {
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

function sharedRewardFields(
  rewardState: RewardState,
  companionRewardCards: BattleCard[] | null = null,
): PendingRewardSharedFields {
  return {
    companionChoiceIds: companionRewardCards?.map((choice) => choice.id) ?? [],
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

  const shared = sharedRewardFields(rewardState, companionRewardCards);
  if (rewardState.rewardType === "gear") {
    return { ...shared, rewardType: "gear", gearChoices: rewardState.choices };
  }
  return {
    ...shared,
    rewardType: rewardState.rewardType,
    choiceIds: rewardState.choices.map((choice) => choice.id),
  };
}

function restoreSharedRewardFields(persisted: PersistedPendingReward): RewardState {
  return {
    ...createEmptyRewardState(filterValidDestinations(persisted.destinations)),
    selectedId: persisted.selectedId,
    gold: persisted.gold,
    materials: persisted.materials,
    selectedBossId: persisted.selectedBossId,
    lastVictoryEnemyType: persisted.lastVictoryEnemyType,
    lastVictoryContentSystem: persisted.lastVictoryContentSystem,
  };
}

function restoreCatalogRewardChoices(
  shared: RewardState,
  rewardType: "card" | "boon" | "trinket",
  choiceIds: readonly string[],
  catalog: Record<string, BattleCard | TrinketEntry | undefined>,
  logContext: string,
): RewardState | null {
  const makeState = (choices: Array<BattleCard | TrinketEntry>): RewardState => {
    if (rewardType === "card") {
      return { ...shared, rewardType: "card", choices: choices as BattleCard[] } satisfies CardRewardState;
    }
    if (rewardType === "boon") {
      return { ...shared, rewardType: "boon", choices: choices as TrinketEntry[] } satisfies BoonRewardState;
    }
    return { ...shared, rewardType: "trinket", choices: choices as TrinketEntry[] } satisfies TrinketRewardState;
  };

  if (choiceIds.length === 0) {
    return hasSharedRewardValue(shared) ? makeState([]) : null;
  }
  const { valid, droppedIds } = resolveCatalogChoicesWithDropped(choiceIds as string[], catalog);
  if (droppedIds.length > 0) {
    logError(`Dropped invalid pending ${logContext} choices`, "storage", { droppedIds });
  }
  if (valid.length === 0) {
    return hasSharedRewardValue(shared) ? makeState([]) : null;
  }
  return makeState(valid);
}

export function restorePendingReward(persisted: PersistedPendingReward): RewardState | null {
  const shared = restoreSharedRewardFields(persisted);

  if (persisted.rewardType === "gear") {
    const choices = nonEmptyChoicesOrNull(persisted.gearChoices);
    if (!choices) {
      return hasSharedRewardValue(shared)
        ? ({ ...shared, rewardType: "gear", choices: [] } satisfies GearRewardState)
        : null;
    }
    return { ...shared, rewardType: "gear", choices } satisfies GearRewardState;
  }

  if (persisted.rewardType === "card") {
    return restoreCatalogRewardChoices(shared, "card", persisted.choiceIds, cardById, "card");
  }

  return restoreCatalogRewardChoices(shared, persisted.rewardType, persisted.choiceIds, trinketById, "trinket/boon");
}

export interface RestoredPendingReward {
  rewardState: RewardState | null;
  companionRewardCards: BattleCard[] | null;
}

export function restorePendingRewardBundle(persisted: PersistedPendingReward): RestoredPendingReward {
  const companionRewardCards = resolveCardChoices(persisted.companionChoiceIds);
  const rewardState = restorePendingReward(persisted);

  if (rewardState || !companionRewardCards) {
    return { rewardState, companionRewardCards };
  }

  return {
    rewardState: restoreSharedRewardFields(persisted),
    companionRewardCards,
  };
}
