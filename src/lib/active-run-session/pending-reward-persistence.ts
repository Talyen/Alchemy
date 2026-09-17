import { cardById, trinketById, type BattleCard, type TrinketEntry } from "@/lib/game-data";
import { logError } from "@/lib/error-logger";
import { filterValidDestinations } from "@/lib/routing";
import type { PersistedPendingReward } from "./types";
import type { PendingRewardSharedFields } from "./pending-reward-shared";
import {
  createEmptyRewardState,
  type BoonRewardState,
  type CardRewardState,
  type GearRewardState,
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
  if (
    rewardState.choices.length === 0 &&
    !companionRewardCards?.length &&
    rewardState.lastVictoryContentSystem === null &&
    rewardState.lastVictoryEnemyType === null &&
    rewardState.selectedBossId === null &&
    rewardState.destinations.length === 0 &&
    rewardState.gold === 0 &&
    !Object.values(rewardState.materials).some((amount) => amount > 0)
  )
    return null;

  const shared = sharedRewardFields(rewardState, companionRewardCards);
  if (rewardState.rewardType === "gear") {
    return rewardState.choices.length > 0
      ? { ...shared, rewardType: "gear", gearChoices: rewardState.choices }
      : { ...shared, rewardType: "card", choiceIds: [] };
  }
  if (rewardState.rewardType === "trinket" || rewardState.rewardType === "boon") {
    return {
      ...shared,
      rewardType: rewardState.rewardType,
      choiceIds: rewardState.choices.map((choice) => choice.id),
    };
  }
  return { ...shared, rewardType: "card", choiceIds: rewardState.choices.map((choice) => choice.id) };
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

export function restorePendingReward(persisted: PersistedPendingReward): RewardState | null {
  const shared = restoreSharedRewardFields(persisted);

  if (persisted.rewardType === "gear") {
    const choices = nonEmptyChoicesOrNull(persisted.gearChoices);
    if (!choices) {
      // Empty gear means “no choices offered”; preserve shared gold/materials
      // the same way card/trinket restores do instead of dropping them.
      return hasSharedRewardValue(shared)
        ? ({ ...shared, rewardType: "card", choices: [] } satisfies CardRewardState)
        : null;
    }
    return { ...shared, rewardType: "gear", choices } satisfies GearRewardState;
  }

  if (persisted.rewardType === "card") {
    if (persisted.choiceIds.length === 0) {
      // Empty means “no choices offered” (e.g. gold-only reward), not invalid data.
      // With no shared value there is nothing to restore.
      return hasSharedRewardValue(shared)
        ? ({ ...shared, rewardType: "card", choices: [] } satisfies CardRewardState)
        : null;
    }
    const { valid, droppedIds } = resolveCatalogChoicesWithDropped(persisted.choiceIds, cardById);
    if (droppedIds.length > 0) {
      logError("Dropped invalid pending card choices", "storage", { droppedIds });
    }
    if (valid.length === 0) {
      // Preserve shared gold/materials/destinations as a standalone reward instead of dropping them.
      return hasSharedRewardValue(shared)
        ? ({ ...shared, rewardType: "card", choices: [] } satisfies CardRewardState)
        : null;
    }
    return { ...shared, rewardType: "card", choices: valid } satisfies CardRewardState;
  }

  const rewardType = persisted.rewardType;
  const toTrinketState = (choices: TrinketEntry[]) =>
    rewardType === "boon"
      ? ({ ...shared, rewardType: "boon", choices } satisfies BoonRewardState)
      : ({ ...shared, rewardType: "trinket", choices } satisfies TrinketRewardState);

  if (persisted.choiceIds.length === 0) {
    return hasSharedRewardValue(shared) ? toTrinketState([]) : null;
  }
  const { valid, droppedIds } = resolveCatalogChoicesWithDropped(persisted.choiceIds, trinketById);
  if (droppedIds.length > 0) {
    logError("Dropped invalid pending trinket/boon choices", "storage", { droppedIds });
  }
  if (valid.length === 0) {
    return hasSharedRewardValue(shared) ? toTrinketState([]) : null;
  }
  return toTrinketState(valid);
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
