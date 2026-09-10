import { isRecord, migrateRunTree, type RawSaveData } from "./types";

function retireHexLabyrinthRun(value: unknown): unknown {
  if (!isRecord(value) || value.contentSystemType !== "labyrinth") return value;
  const map = value.labyrinthMap;
  if (!isRecord(map) || !Array.isArray(map.floors) || map.floors.some((floor) => !isRecord(floor) || floor.depth === 0))
    return null;
  return value;
}

export function migrateV16ToV17(parsed: RawSaveData): RawSaveData {
  return migrateRunTree(parsed, retireHexLabyrinthRun);
}
