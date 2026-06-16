import type { ContentSystemId } from "@/lib/content-systems/types";
import type { GearInstance } from "@/lib/gear/types";
import type { MaterialInventory } from "@/lib/homestead/types";

export type PersistedPendingRewardBase = {
  selectedId: string | null;
  gold: number;
  materials: MaterialInventory;
  destinations: string[];
  selectedBossId: string | null;
  lastVictoryEnemyType: string | null;
  lastVictoryContentSystem: ContentSystemId | null;
};

export type PersistedPendingReward =
  | (PersistedPendingRewardBase & { rewardType: "card"; choiceIds: string[] })
  | (PersistedPendingRewardBase & { rewardType: "trinket"; choiceIds: string[] })
  | (PersistedPendingRewardBase & { rewardType: "gear"; gearChoices: GearInstance[] });
