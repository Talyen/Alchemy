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

export type BoonRewardState = RewardStateBase & {
  rewardType: "boon";
  choices: TrinketEntry[];
};

export type TrinketRewardState = RewardStateBase & {
  rewardType: "trinket";
  choices: TrinketEntry[];
};

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
  const choice = rewardState.choices.find((item) => getRewardChoiceId(item) === id);
  if (!choice) return null;
  switch (rewardState.rewardType) {
    case "card":
      return { rewardType: "card", choice: choice as BattleCard };
    case "boon":
      return { rewardType: "boon", choice: choice as TrinketEntry };
    case "trinket":
      return { rewardType: "trinket", choice: choice as TrinketEntry };
    case "gear":
      return { rewardType: "gear", choice: choice as GearInstance };
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
