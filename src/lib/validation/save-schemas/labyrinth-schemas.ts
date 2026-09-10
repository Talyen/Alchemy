import { z } from "zod";
import type { LabyrinthMap, LabyrinthNode } from "@/lib/content-systems/types";
import type { EncounterCombatTraitId, EncounterRewardTraitId } from "@/lib/content-systems/encounter-traits";
import { LabyrinthNodeTypeSchema } from "./schema-enums";
import { sanitizeEncounterTraitIds } from "@/lib/content-systems/encounter-traits";
import {
  LABYRINTH_GRID,
  gridKey,
  isInLabyrinthGrid,
  labyrinthGridPositions,
} from "@/lib/content-systems/labyrinth/grid";

export const EncounterCombatTraitArraySchema = z
  .array(z.string())
  .transform((values): EncounterCombatTraitId[] => sanitizeEncounterTraitIds(values, "combat"))
  .catch([] as EncounterCombatTraitId[]);
export const EncounterRewardTraitArraySchema = z
  .array(z.string())
  .transform((values): EncounterRewardTraitId[] => sanitizeEncounterTraitIds(values, "reward"))
  .catch([] as EncounterRewardTraitId[]);

const LabyrinthGridPositionSchema = z.object({
  row: z.number().int(),
  col: z.number().int(),
});

const LabyrinthNodeSchema = z
  .object({
    id: z.string().min(1),
    type: LabyrinthNodeTypeSchema,
    floor: z.number().int().positive(),
    gridPosition: LabyrinthGridPositionSchema,
    modifiers: EncounterCombatTraitArraySchema,
    rewardModifiers: EncounterRewardTraitArraySchema,
    cleared: z.boolean().catch(false),
    enemyId: z.string().optional(),
  })
  .transform((node): LabyrinthNode => {
    const { enemyId, ...rest } = node;
    return enemyId === undefined ? rest : { ...rest, enemyId };
  });

const LabyrinthFloorSchema = z.object({
  id: z.string().min(1),
  depth: z.number().int().positive(),
  nodeIds: z.array(z.string().min(1)).length(labyrinthGridPositions().length),
});

interface LabyrinthMapShape {
  floors: Array<{ id: string; depth: number; nodeIds: string[] }>;
  nodes: Record<string, LabyrinthNode>;
  currentFloor: number;
}

function isValidLabyrinthMap(map: LabyrinthMapShape): boolean {
  const floorDepths = new Set<number>();
  const seenNodeIds = new Set<string>();
  for (const floor of map.floors) {
    if (floorDepths.has(floor.depth)) return false;
    floorDepths.add(floor.depth);
    const occupied = new Set<string>();
    let entrance: LabyrinthNode | undefined;
    let boss: LabyrinthNode | undefined;
    for (const nodeId of floor.nodeIds) {
      const node = map.nodes[nodeId];
      if (!node || node.id !== nodeId || node.floor !== floor.depth || seenNodeIds.has(nodeId)) return false;
      seenNodeIds.add(nodeId);
      if (!isInLabyrinthGrid(node.gridPosition)) return false;
      const key = gridKey(node.gridPosition);
      if (occupied.has(key)) return false;
      occupied.add(key);
      if (node.type === "entrance") {
        if (entrance || !node.cleared || node.gridPosition.row !== 0) return false;
        entrance = node;
      }
      if (node.type === "boss") {
        if (boss || node.gridPosition.row !== LABYRINTH_GRID.rows - 1) return false;
        boss = node;
      }
    }
    if (
      !entrance ||
      !boss ||
      Math.abs(entrance.gridPosition.col - boss.gridPosition.col) < LABYRINTH_GRID.minimumBossColumnDistance
    )
      return false;
  }
  return (
    Object.keys(map.nodes).length === seenNodeIds.size &&
    floorDepths.has(map.currentFloor) &&
    Array.from({ length: map.floors.length }, (_, index) => index + 1).every((depth) => floorDepths.has(depth))
  );
}

export const LabyrinthMapSchema = z
  .object({
    floors: z.array(LabyrinthFloorSchema).min(1),
    nodes: z.record(z.string(), LabyrinthNodeSchema),
    currentFloor: z.number().int().positive().catch(1),
    currentNodeId: z.string().min(1).catch(""),
  })
  .refine(isValidLabyrinthMap, { message: "Invalid labyrinth map structure" })
  .transform((map): LabyrinthMap => {
    const currentNode = map.nodes[map.currentNodeId];
    const entrance = Object.values(map.nodes).find(
      (node) => node.floor === map.currentFloor && node.type === "entrance",
    )!;
    return {
      ...map,
      currentNodeId: currentNode?.floor === map.currentFloor && currentNode.cleared ? currentNode.id : entrance.id,
    };
  })
  .nullable()
  .catch(null);

export const LabyrinthPendingNodeSchema = z.string().min(1).nullable().catch(null);
