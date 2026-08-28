import { z } from "zod";
import type { LabyrinthMap, LabyrinthNode } from "@/lib/content-systems/types";
import type { EncounterCombatTraitId, EncounterRewardTraitId } from "@/lib/content-systems/encounter-traits";
import { LabyrinthNodeTypeSchema } from "./schema-enums";
import { sanitizeEncounterTraitIds } from "@/lib/content-systems/encounter-traits";
import { isHexInBounds, hexKey } from "@/lib/content-systems/labyrinth/hex-grid";
import { LABYRINTH_ENTRANCE_NODE_ID } from "@/lib/content-systems/labyrinth/data";

export const EncounterCombatTraitArraySchema = z
  .array(z.string())
  .transform((values): EncounterCombatTraitId[] => sanitizeEncounterTraitIds(values, "combat"))
  .catch([] as EncounterCombatTraitId[]);
export const EncounterRewardTraitArraySchema = z
  .array(z.string())
  .transform((values): EncounterRewardTraitId[] => sanitizeEncounterTraitIds(values, "reward"))
  .catch([] as EncounterRewardTraitId[]);

const LabyrinthGridPositionSchema = z.object({
  row: z.number().int().catch(0),
  col: z.number().int().catch(0),
});

const LabyrinthNodeSchema = z
  .object({
    id: z.string().min(1),
    type: LabyrinthNodeTypeSchema,
    floor: z.number().int().nonnegative().catch(0),
    gridPosition: LabyrinthGridPositionSchema,
    modifiers: EncounterCombatTraitArraySchema,
    rewardModifiers: EncounterRewardTraitArraySchema,
    outgoingIds: z.array(z.string()).catch([]),
    cleared: z.boolean().catch(false),
    enemyId: z.string().optional(),
  })
  .transform((node): LabyrinthNode => {
    const { enemyId, ...rest } = node;
    return enemyId === undefined ? rest : { ...rest, enemyId };
  });

const LabyrinthFloorSchema = z.object({
  id: z.string().min(1),
  depth: z.number().int().nonnegative().catch(0),
  nodeIds: z.array(z.string().min(1)).min(1),
});

interface LabyrinthMapShape {
  floors: Array<{ id: string; depth: number; nodeIds: string[] }>;
  nodes: Record<string, LabyrinthNode>;
  currentFloor: number;
}

function isValidLabyrinthMap(map: LabyrinthMapShape): boolean {
  if (map.floors.length < 2) return false;
  const floorDepths = new Set<number>();
  const seenNodeIds = new Set<string>();
  let entranceCount = 0;

  for (const floor of map.floors) {
    if (floorDepths.has(floor.depth)) return false;
    floorDepths.add(floor.depth);
    const occupied = new Set<string>();
    let bossCount = 0;
    for (const nodeId of floor.nodeIds) {
      const node = map.nodes[nodeId];
      if (!node || node.id !== nodeId) return false;
      if (node.floor !== floor.depth) return false;
      if (seenNodeIds.has(nodeId)) return false;
      seenNodeIds.add(nodeId);
      if (!isHexInBounds(node.gridPosition) && floor.depth > 0) return false;
      const key = hexKey(node.gridPosition);
      if (occupied.has(key)) return false;
      occupied.add(key);
      if (node.type === "entrance") entranceCount += 1;
      if (node.type === "boss") bossCount += 1;
      for (const outgoingId of node.outgoingIds) {
        if (!map.nodes[outgoingId]) return false;
      }
    }
    if (floor.depth === 0) {
      if (floor.nodeIds.length !== 1 || map.nodes[floor.nodeIds[0]!]?.type !== "entrance") return false;
    } else if (bossCount !== 1) {
      return false;
    }
  }

  if (entranceCount !== 1) return false;
  const extraNodes = Object.keys(map.nodes).some((id) => !seenNodeIds.has(id));
  if (extraNodes) return false;
  if (!floorDepths.has(map.currentFloor) || map.currentFloor < 1) return false;
  const entrance = map.nodes[LABYRINTH_ENTRANCE_NODE_ID];
  return Boolean(entrance?.cleared && entrance.type === "entrance");
}

export const LabyrinthMapSchema = z
  .object({
    floors: z.array(LabyrinthFloorSchema),
    nodes: z.record(z.string(), LabyrinthNodeSchema),
    currentFloor: z.number().int().positive().catch(1),
  })
  .refine(isValidLabyrinthMap, { message: "Invalid labyrinth map structure" })
  .transform((map): LabyrinthMap => map)
  .nullable()
  .catch(null);

export const LabyrinthPendingNodeSchema = z.string().min(1).nullable().catch(null);
