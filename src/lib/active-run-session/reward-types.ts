import type { BattleCard, TrinketEntry } from "@/lib/game-data";
import type { GearInstance } from "@/lib/gear";
import { emptyInventory } from "@/lib/homestead/inventory";
import type { PendingRewardSharedInput } from "./pending-reward-shared";
import type { Destination } from "@/lib/routing";

type RewardStateBase = PendingRewardSharedInput;

export type CardRewardState = RewardStateBase & {
  rewardType: "card";
  choices: BattleCard[];
};

type TrinketChoiceRewardState<RewardType extends "boon" | "trinket"> = RewardStateBase & {
  rewardType: RewardType;
  choices: TrinketEntry[];
};

export type BoonRewardState = TrinketChoiceRewardState<"boon">;

export type TrinketRewardState = TrinketChoiceRewardState<"trinket">;

export type GearRewardState = RewardStateBase & {
  rewardType: "gear";
  choices: GearInstance[];
};

export type RewardState = CardRewardState | BoonRewardState | TrinketRewardState | GearRewardState;

export type ResolvedRewardChoice =
  | { rewardType: "card"; choice: BattleCard }
  | { rewardType: "boon"; choice: TrinketEntry }
  | { rewardType: "trinket"; choice: TrinketEntry }
  | { rewardType: "gear"; choice: GearInstance };

export function getRewardChoiceId(choice: BattleCard | TrinketEntry | GearInstance): string {
  return "instanceId" in choice ? choice.instanceId : choice.id;
}

export function resolveRewardChoice(
  rewardState: RewardState,
  id = rewardState.selectedId,
): ResolvedRewardChoice | null {
  if (!id) return null;
  switch (rewardState.rewardType) {
    case "card": {
      const choice = rewardState.choices.find((card) => card.id === id);
      return choice ? { rewardType: "card", choice } : null;
    }
    case "boon": {
      const choice = rewardState.choices.find((boon) => boon.id === id);
      return choice ? { rewardType: "boon", choice } : null;
    }
    case "trinket": {
      const choice = rewardState.choices.find((trinket) => trinket.id === id);
      return choice ? { rewardType: "trinket", choice } : null;
    }
    case "gear": {
      const choice = rewardState.choices.find((gear) => gear.instanceId === id);
      return choice ? { rewardType: "gear", choice } : null;
    }
  }
}

export function createEmptyRewardState(destinations: Destination[] = []): CardRewardState {
  return {
    choices: [],
    companionChoiceIds: [],
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
