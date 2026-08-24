// Runtime reward state shared by run session and persistence restore.
import type { BattleCard, TrinketEntry } from "@/lib/game-data";
import type { GearInstance } from "@/lib/gear";
import { emptyInventory } from "@/lib/homestead/inventory";
import type { PendingRewardSharedFields } from "./pending-reward-shared";
import type { Destination } from "@/lib/routing";

type RewardStateBase = PendingRewardSharedFields & {
  destinations: Destination[];
};

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

export function getRewardChoiceId(choice: BattleCard | TrinketEntry | GearInstance): string {
  return "instanceId" in choice ? choice.instanceId : choice.id;
}

export function createEmptyRewardState(destinations: Destination[] = []): CardRewardState {
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
