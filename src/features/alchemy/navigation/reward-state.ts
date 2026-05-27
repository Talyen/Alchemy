// Reward screen state shape and empty/next-state factories.
import type { BattleCard, TrinketEntry } from "@/lib/game-data";
import type { MaterialInventory } from "@/lib/homestead/types";
import { emptyInventory } from "@/lib/homestead/inventory";
import type { Destination } from "../types";

export type RewardState = {
  choices: (BattleCard | TrinketEntry)[];
  gold: number;
  materials: MaterialInventory;
  selectedId: string | null;
  destinations: Destination[];
  rewardType: "card" | "trinket";
  selectedBossId: string | null;
};

export function createEmptyRewardState(destinations: Destination[] = []): RewardState {
  return {
    choices: [],
    gold: 0,
    materials: emptyInventory(),
    selectedId: null,
    destinations,
    rewardType: "card",
    selectedBossId: null,
  };
}

export function createNextRewardState(rewardState: RewardState): RewardState {
  return { ...createEmptyRewardState(rewardState.destinations), selectedBossId: rewardState.selectedBossId };
}
