import { DESTINATIONS_PER_ACT } from "@/lib/game-constants";
import { DIFFICULTY_ORDER, type DifficultyId } from "@/lib/game-data";
import type { LabyrinthMap } from "@/lib/content-systems/types";
import type { LootProgress } from "./policy";

export function campaignLootDepth(currentAct: number, destinationIndexInAct: number): number {
  return Math.max(1, (currentAct - 1) * DESTINATIONS_PER_ACT + destinationIndexInAct + 1);
}

export function labyrinthLootDepth(map: LabyrinthMap | null, pendingNodeId: string | null = null): number {
  if (!map) return 1;
  const cleared = Object.values(map.nodes).filter((node) => node.cleared && node.type !== "entrance").length;
  const pending = pendingNodeId ? map.nodes[pendingNodeId] : undefined;
  return Math.max(1, cleared + (pending?.cleared ? 0 : 1));
}

export function highestCompletedLootDifficulty(
  completed: Readonly<Record<string, readonly DifficultyId[]>>,
): DifficultyId | null {
  const clears = new Set(Object.values(completed).flat());
  return [...DIFFICULTY_ORDER].reverse().find((id) => clears.has(id)) ?? null;
}

export function createLootProgress(
  depth: number,
  completed: Readonly<Record<string, readonly DifficultyId[]>>,
): LootProgress {
  return { depth: Math.max(1, depth), highestCompletedDifficulty: highestCompletedLootDifficulty(completed) };
}
