// Zod schemas for labyrinth map persistence.
import { z } from "zod";
import { LABYRINTH_MIN_CONNECTIONS, LABYRINTH_MAX_CONNECTIONS } from "@/lib/game-constants";
import { LabyrinthNodeStateSchema, LabyrinthNodeTypeSchema } from "./schema-enums";
import { sanitizeEncounterTraitIds } from "@/lib/content-systems/encounter-traits";

export const EncounterCombatTraitArraySchema = z
  .array(z.string())
  .transform((values) => sanitizeEncounterTraitIds(values, "combat"))
  .catch([]);
export const EncounterRewardTraitArraySchema = z
  .array(z.string())
  .transform((values) => sanitizeEncounterTraitIds(values, "reward"))
  .catch([]);

export const LabyrinthNodeSchema = z
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
  .nullable()
  .catch(null);

type LabyrinthMapShape = {
  rows: number;
  cols: number;
  grid: Array<Array<z.infer<typeof LabyrinthNodeSchema> | null>>;
  currentNode: { row: number; col: number };
};

function isValidLabyrinthMap(map: LabyrinthMapShape): boolean {
  if (map.rows <= 0 || map.cols <= 0) return false;
  if (map.grid.length !== map.rows) return false;
  if (map.grid.some((row) => row.length !== map.cols)) return false;
  const current = map.grid[map.currentNode.row]?.[map.currentNode.col];
  if (!current) return false;
  let entranceCount = 0;
  let bossCount = 0;
  let currentCount = 0;
  for (let r = 0; r < map.rows; r++) {
    const row = map.grid[r];
    if (!row) return false;
    for (let c = 0; c < map.cols; c++) {
      const node = row[c];
      if (!node) continue;
      if (node.type === "entrance") entranceCount++;
      if (node.type === "boss") bossCount++;
      if (node.state === "current") {
        currentCount++;
        if (map.currentNode.row !== r || map.currentNode.col !== c) return false;
      }
      if (node.connections.length < LABYRINTH_MIN_CONNECTIONS || node.connections.length > LABYRINTH_MAX_CONNECTIONS)
        return false;
      for (const conn of node.connections) {
        const target = map.grid[conn.row]?.[conn.col];
        if (!target) return false;
        const dr = Math.abs(conn.row - r);
        const dc = Math.abs(conn.col - c);
        if (!((dr === 1 && dc === 0) || (dr === 0 && dc === 1))) return false;
      }
    }
  }
  return entranceCount === 1 && bossCount === 1 && currentCount === 1;
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
  .nullable()
  .catch(null);
