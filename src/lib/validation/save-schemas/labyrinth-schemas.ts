// Zod schemas for labyrinth map persistence.
import { z } from "zod";
import { LABYRINTH_MIN_CONNECTIONS, LABYRINTH_MAX_CONNECTIONS } from "@/lib/game-constants";
import type { LabyrinthMap, LabyrinthNode } from "@/lib/content-systems/types";
import type { EncounterCombatTraitId, EncounterRewardTraitId } from "@/lib/content-systems/encounter-traits";
import { LabyrinthNodeStateSchema, LabyrinthNodeTypeSchema } from "./schema-enums";
import { sanitizeEncounterTraitIds } from "@/lib/content-systems/encounter-traits";

export const EncounterCombatTraitArraySchema = z
  .array(z.string())
  .transform((values): EncounterCombatTraitId[] => sanitizeEncounterTraitIds(values, "combat"))
  .catch([] as EncounterCombatTraitId[]);
export const EncounterRewardTraitArraySchema = z
  .array(z.string())
  .transform((values): EncounterRewardTraitId[] => sanitizeEncounterTraitIds(values, "reward"))
  .catch([] as EncounterRewardTraitId[]);

const LabyrinthNodeSchema = z
  .object({
    type: LabyrinthNodeTypeSchema,
    modifiers: EncounterCombatTraitArraySchema,
    rewardModifiers: EncounterRewardTraitArraySchema,
    connections: z
      .array(
        z.object({
          row: z.number().int().nonnegative().catch(0),
          col: z.number().int().nonnegative().catch(0),
        }),
      )
      .catch([]),
    state: LabyrinthNodeStateSchema,
    enemyId: z.string().optional(),
  })
  .transform((node): LabyrinthNode => {
    const { enemyId, ...rest } = node;
    return enemyId === undefined ? rest : { ...rest, enemyId };
  })
  .nullable()
  .catch(null);

interface LabyrinthMapShape {
  rows: number;
  cols: number;
  grid: Array<Array<z.infer<typeof LabyrinthNodeSchema> | null>>;
  currentNode: { row: number; col: number };
}

function hasValidGridDimensions(map: LabyrinthMapShape): boolean {
  if (map.rows <= 0 || map.cols <= 0) return false;
  if (map.grid.length !== map.rows) return false;
  return !map.grid.some((row) => row.length !== map.cols);
}

function isAdjacentNeighbor(a: { row: number; col: number }, b: { row: number; col: number }): boolean {
  const dr = Math.abs(a.row - b.row);
  const dc = Math.abs(a.col - b.col);
  return (dr === 1 && dc === 0) || (dr === 0 && dc === 1);
}

function validateNodeConnections(
  map: LabyrinthMapShape,
  node: NonNullable<LabyrinthMapShape["grid"][number][number]>,
  r: number,
  c: number,
): boolean {
  if (node.connections.length < LABYRINTH_MIN_CONNECTIONS || node.connections.length > LABYRINTH_MAX_CONNECTIONS)
    return false;
  for (const conn of node.connections) {
    const target = map.grid[conn.row]?.[conn.col];
    if (!target) return false;
    if (!isAdjacentNeighbor(conn, { row: r, col: c })) return false;
  }
  return true;
}

function countNodeTypes(
  map: LabyrinthMapShape,
): { entranceCount: number; bossCount: number; currentCount: number } | null {
  let entranceCount = 0;
  let bossCount = 0;
  let currentCount = 0;
  for (let r = 0; r < map.rows; r++) {
    const row = map.grid[r];
    if (!row) return null;
    for (let c = 0; c < map.cols; c++) {
      const node = row[c];
      if (!node) continue;
      if (node.type === "entrance") entranceCount++;
      if (node.type === "boss") bossCount++;
      if (node.state === "current") {
        currentCount++;
        if (map.currentNode.row !== r || map.currentNode.col !== c) return null;
      }
      if (!validateNodeConnections(map, node, r, c)) return null;
    }
  }
  return { entranceCount, bossCount, currentCount };
}

function isValidLabyrinthMap(map: LabyrinthMapShape): boolean {
  if (!hasValidGridDimensions(map)) return false;
  const current = map.grid[map.currentNode.row]?.[map.currentNode.col];
  if (!current) return false;
  const counts = countNodeTypes(map);
  if (!counts) return false;
  return counts.entranceCount === 1 && counts.bossCount === 1 && counts.currentCount === 1;
}

export const LabyrinthMapSchema = z
  .object({
    grid: z.array(z.array(LabyrinthNodeSchema)),
    rows: z.number().int().nonnegative().catch(0),
    cols: z.number().int().nonnegative().catch(0),
    currentNode: z
      .object({
        row: z.number().int().nonnegative().catch(0),
        col: z.number().int().nonnegative().catch(0),
      })
      .catch({ row: 0, col: 0 }),
  })
  .refine(isValidLabyrinthMap, { message: "Invalid labyrinth map structure" })
  .transform((map): LabyrinthMap => map)
  .nullable()
  .catch(null);
