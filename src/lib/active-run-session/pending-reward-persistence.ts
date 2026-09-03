import { cardById, trinketById, type BattleCard, type TrinketEntry } from "@/lib/game-data";
import type { GearInstance } from "@/lib/gear";
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

export function lookupTrinketEntries(ids: string[]): TrinketEntry[] {
  return ids.map((id) => trinketById[id]).filter((trinket): trinket is TrinketEntry => Boolean(trinket));
}

function resolveGearChoices(gearChoices: GearInstance[]): GearInstance[] | null {
  return gearChoices.length === 0 ? null : gearChoices;
}

function resolveCardChoices(choiceIds: string[]): BattleCard[] | null {
  const choices = choiceIds.map((id) => cardById[id]).filter((entry): entry is BattleCard => Boolean(entry));
  return choices.length === 0 ? null : choices;
}

function resolveCompanionChoices(choiceIds: string[]): BattleCard[] | null {
  const choices = choiceIds
    .map((id) => cardById[id])
    .filter((entry): entry is BattleCard =>
      Boolean(entry && entry.effects.some((effect) => effect.kind === "summon-companion")),
    );
  return choices.length === 0 ? null : choices;
}

function resolveTrinketChoices(choiceIds: string[]): TrinketEntry[] | null {
  const choices = lookupTrinketEntries(choiceIds);
  return choices.length === 0 ? null : choices;
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
  if (rewardState.choices.length === 0 && !companionRewardCards?.length) return null;

  const shared = sharedRewardFields(rewardState, companionRewardCards);
  if (rewardState.rewardType === "gear") {
    return { ...shared, rewardType: "gear", gearChoices: rewardState.choices };
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
    const choices = resolveGearChoices(persisted.gearChoices);
    if (!choices) return null;
    return { ...shared, rewardType: "gear", choices } satisfies GearRewardState;
  }

  if (persisted.rewardType === "card") {
    const choices = resolveCardChoices(persisted.choiceIds);
    if (!choices) return null;
    return { ...shared, rewardType: "card", choices } satisfies CardRewardState;
  }

  const choices = resolveTrinketChoices(persisted.choiceIds);
  if (!choices) return null;
  return persisted.rewardType === "boon"
    ? ({ ...shared, rewardType: "boon", choices } satisfies BoonRewardState)
    : ({ ...shared, rewardType: "trinket", choices } satisfies TrinketRewardState);
}

export interface RestoredPendingReward {
  rewardState: RewardState | null;
  companionRewardCards: BattleCard[] | null;
}

export function restorePendingRewardBundle(persisted: PersistedPendingReward): RestoredPendingReward {
  const companionRewardCards = resolveCompanionChoices(persisted.companionChoiceIds);
  const rewardState = restorePendingReward(persisted);

  if (rewardState || !companionRewardCards) {
    return { rewardState, companionRewardCards };
  }

  return {
    rewardState: restoreSharedRewardFields(persisted),
    companionRewardCards,
  };
}
