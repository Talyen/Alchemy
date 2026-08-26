import type { ContentSystemId } from "@/lib/content-systems/types";
import type { EnemyType } from "@/lib/game-data";
import type { MaterialInventory } from "@/lib/homestead/types";

/** Fields shared by persisted and runtime pending-reward state. */
export interface PendingRewardSharedFields {
  selectedId: string | null;
  gold: number;
  materials: MaterialInventory;
  selectedBossId: string | null;
  lastVictoryEnemyType: EnemyType | null;
  lastVictoryContentSystem: ContentSystemId | null;
}
