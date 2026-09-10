import { createSeededRng } from "@/lib/utils";
import { addLabyrinthSideRooms } from "@/lib/content-systems/labyrinth/map-generation";
import type { LabyrinthMap } from "@/lib/content-systems/types";
import { isRecord, migrateRunTree, rngSeedFromRun, type RawSaveData } from "./types";

function expandOpenFieldRun(value: unknown): unknown {
  if (!isRecord(value) || value.contentSystemType !== "labyrinth") return value;
  const map = value.labyrinthMap;
  if (!isRecord(map) || !Array.isArray(map.floors) || !isRecord(map.nodes)) return value;
  const nodes = map.nodes;
  if (
    !map.floors.every(
      (floor) =>
        isRecord(floor) &&
        Array.isArray(floor.nodeIds) &&
        floor.nodeIds.every((id) => typeof id === "string" && isRecord(nodes[id]) && isRecord(nodes[id].gridPosition)),
    ) ||
    !Object.values(nodes).every((node) => isRecord(node) && isRecord(node.gridPosition)) ||
    !map.floors.some((floor) => isRecord(floor) && Array.isArray(floor.nodeIds) && floor.nodeIds.length === 16)
  )
    return value;
  return {
    ...value,
    labyrinthMap: addLabyrinthSideRooms(map as unknown as LabyrinthMap, createSeededRng(rngSeedFromRun(value))),
  };
}

export function migrateV17ToV18(parsed: RawSaveData): RawSaveData {
  return migrateRunTree(parsed, expandOpenFieldRun);
}
