import { DESTINATIONS_PER_ACT } from "@/lib/game-constants";
import { DIFFICULTY_ORDER, type DifficultyId } from "@/lib/game-data";
import type { LabyrinthMap } from "@/lib/content-systems/types";
import type { LootProgress } from "./policy";

/**
 * Campaign loot depth counts the opening battle as 1, then every destination
 * across Acts without resetting. `destinationIndexInAct` runs 0..7 for the
 * Act's destinations with 8 reserved for the boss, so the first boss is depth
 * 9 and the depth cap is ACTS_PER_RUN * DESTINATIONS_PER_ACT + 1 (25).
 */
export function campaignLootDepth(currentAct: number, destinationIndexInAct: number): number {
  return Math.max(1, (currentAct - 1) * DESTINATIONS_PER_ACT + destinationIndexInAct + 1);
}

/**
 * Labyrinth loot depth counts cleared non-entrance rooms across floors plus
 * one for the room currently being approached. A null pending node still adds
 * that one: it means "depth of the next room". Clearing the pending room
 * increments the cleared count, so depth stays stable across the transition
 * and advances only once a new pending room is set.
 */
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
