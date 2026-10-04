import type { ContentSystemId } from "@/lib/content-systems/types";
import type { BattleCard, EnemyType, TrinketEntry } from "@/lib/game-data";
import type { GearInstance } from "@/lib/gear";
import { emptyInventory } from "@/lib/homestead/inventory";
import type { MaterialInventory } from "@/lib/homestead/types";
import type { Destination } from "@/lib/routing";

export interface PendingRewardSharedFields {
  companionChoiceIds: string[];
  selectedId: string | null;
  gold: number;
  materials: MaterialInventory;
  destinations: Destination[];
  selectedBossId: string | null;
  lastVictoryEnemyType: EnemyType | null;
  lastVictoryContentSystem: ContentSystemId | null;
}

type RewardStateBase = Omit<PendingRewardSharedFields, "companionChoiceIds">;

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
  const choice = rewardState.choices.find((item) => getRewardChoiceId(item) === id);
  return choice ? ({ rewardType: rewardState.rewardType, choice } as ResolvedRewardChoice) : null;
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
