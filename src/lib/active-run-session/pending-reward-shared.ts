import type { ContentSystemId } from "@/lib/content-systems/types";
import type { MaterialInventory } from "@/lib/homestead/types";

/** Fields shared by persisted and runtime pending-reward state. */
export interface PendingRewardSharedFields {
  selectedId: string | null;
  gold: number;
  materials: MaterialInventory;
  selectedBossId: string | null;
  lastVictoryEnemyType: string | null;
  lastVictoryContentSystem: ContentSystemId | null;
}
