import { getOfferableCardPool, trinketLibrary, type BattleCard, type TrinketEntry } from "@/lib/game-data";
import type { ContentSystemId } from "@/lib/content-systems/types";
import { emptyInventory } from "@/lib/homestead/inventory";
import type { MaterialInventory } from "@/lib/homestead/types";
import { normalizeGearInstance } from "@/lib/gear/operations";
import type { GearInstance } from "@/lib/gear/types";
import type { PersistedPendingReward } from "./pending-reward";

export type PendingRewardStateBase = {
  gold: number;
  materials: MaterialInventory;
  selectedId: string | null;
  destinations: string[];
  selectedBossId: string | null;
  lastVictoryEnemyType: string | null;
  lastVictoryContentSystem: ContentSystemId | null;
};

export type PendingCardRewardState = PendingRewardStateBase & {
  rewardType: "card";
  choices: BattleCard[];
};

export type PendingTrinketRewardState = PendingRewardStateBase & {
  rewardType: "trinket";
  choices: TrinketEntry[];
};

export type PendingGearRewardState = PendingRewardStateBase & {
  rewardType: "gear";
  choices: GearInstance[];
};

export type PendingRewardState = PendingCardRewardState | PendingTrinketRewardState | PendingGearRewardState;

function createEmptyPendingRewardState(destinations: string[] = []): PendingCardRewardState {
  return {
    choices: [],
    gold: 0,
    materials: emptyInventory(),
    selectedId: null,
    destinations,
    rewardType: "card",
    selectedBossId: null,
    lastVictoryEnemyType: null,
    lastVictoryContentSystem: null,
  };
}

function sharedRewardFields(
  rewardState: PendingRewardState,
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

export function serializePendingReward(rewardState: PendingRewardState): PersistedPendingReward | null {
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

export function restorePendingReward(persisted: PersistedPendingReward): PendingRewardState | null {
  const shared = {
    ...createEmptyPendingRewardState(persisted.destinations),
    selectedId: persisted.selectedId,
    gold: persisted.gold,
    materials: persisted.materials,
    selectedBossId: persisted.selectedBossId,
    lastVictoryEnemyType: persisted.lastVictoryEnemyType,
    lastVictoryContentSystem: persisted.lastVictoryContentSystem,
  };

  if (persisted.rewardType === "gear") {
    const choices = persisted.gearChoices
      .map((instance) => normalizeGearInstance(instance))
      .filter((instance): instance is NonNullable<typeof instance> => Boolean(instance));
    if (choices.length === 0) return null;
    return { ...shared, rewardType: "gear", choices } satisfies PendingGearRewardState;
  }

  if (persisted.rewardType === "card") {
    const choices = persisted.choiceIds
      .map((id) => getOfferableCardPool().find((entry) => entry.id === id))
      .filter((entry): entry is BattleCard => Boolean(entry));
    if (choices.length === 0) return null;
    return { ...shared, rewardType: "card", choices } satisfies PendingCardRewardState;
  }

  const choices = persisted.choiceIds
    .map((id) => trinketLibrary.find((entry) => entry.id === id))
    .filter((entry): entry is TrinketEntry => Boolean(entry));
  if (choices.length === 0) return null;
  return { ...shared, rewardType: "trinket", choices } satisfies PendingTrinketRewardState;
}
