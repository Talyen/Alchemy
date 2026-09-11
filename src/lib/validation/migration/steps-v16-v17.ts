import { defineRunStep, isRecord } from "./types";

function retireHexLabyrinthRun(value: unknown): unknown {
  if (!isRecord(value) || value.contentSystemType !== "labyrinth") return value;
  const map = value.labyrinthMap;
  if (!isRecord(map) || !Array.isArray(map.floors) || map.floors.some((floor) => !isRecord(floor) || floor.depth === 0))
    return null;
  return value;
}

export const migrateV16ToV17 = defineRunStep(retireHexLabyrinthRun);
