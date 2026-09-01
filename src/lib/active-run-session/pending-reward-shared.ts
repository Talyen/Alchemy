import type { ContentSystemId } from "@/lib/content-systems/types";
import type { EnemyType } from "@/lib/game-data";
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

export type PendingRewardSharedInput = Omit<PendingRewardSharedFields, "companionChoiceIds"> & {
  companionChoiceIds?: string[];
};

export type PersistedRewardSharedFields = PendingRewardSharedFields;
