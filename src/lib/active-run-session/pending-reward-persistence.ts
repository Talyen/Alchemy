import { getOfferableCardPool, trinketLibrary, type BattleCard, type TrinketEntry } from "@/lib/game-data";
import type { GearInstance } from "@/lib/gear/types";
import type { Destination } from "@/lib/routing";
import type { PersistedPendingReward } from "./types";
import {
  createEmptyRewardState,
  type CardRewardState,
  type GearRewardState,
  type RewardState,
  type TrinketRewardState,
} from "./reward-types";

export function lookupTrinketEntries(ids: string[]): TrinketEntry[] {
  return ids.flatMap((id) => {
    const trinket = trinketLibrary.find((entry) => entry.id === id);
    return trinket ? [trinket] : [];
  });
}

export function resolveGearChoices(gearChoices: GearInstance[]): GearInstance[] | null {
  return gearChoices.length === 0 ? null : gearChoices;
}

export function resolveCardChoices(choiceIds: string[]): BattleCard[] | null {
  const choices = choiceIds
    .map((id) => getOfferableCardPool().find((entry) => entry.id === id))
    .filter((entry): entry is BattleCard => Boolean(entry));
  return choices.length === 0 ? null : choices;
}

export function resolveTrinketChoices(choiceIds: string[]): TrinketEntry[] | null {
  const choices = lookupTrinketEntries(choiceIds);
  return choices.length === 0 ? null : choices;
}

function sharedRewardFields(
  rewardState: RewardState,
): Omit<PersistedPendingReward, "rewardType" | "choiceIds" | "gearChoices"> {
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

export function serializePendingReward(rewardState: RewardState): PersistedPendingReward | null {
  if (rewardState.choices.length === 0) return null;

  const shared = sharedRewardFields(rewardState);
  if (rewardState.rewardType === "gear") {
    return { ...shared, rewardType: "gear", gearChoices: rewardState.choices };
  }
  if (rewardState.rewardType === "trinket") {
    return { ...shared, rewardType: "trinket", choiceIds: rewardState.choices.map((choice) => choice.id) };
  }
  return { ...shared, rewardType: "card", choiceIds: rewardState.choices.map((choice) => choice.id) };
}

export function restorePendingReward(persisted: PersistedPendingReward): RewardState | null {
  const shared = {
    ...createEmptyRewardState(persisted.destinations as Destination[]),
    selectedId: persisted.selectedId,
    gold: persisted.gold,
    materials: persisted.materials,
    selectedBossId: persisted.selectedBossId,
    lastVictoryEnemyType: persisted.lastVictoryEnemyType,
    lastVictoryContentSystem: persisted.lastVictoryContentSystem,
  };

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
  return { ...shared, rewardType: "trinket", choices } satisfies TrinketRewardState;
}
