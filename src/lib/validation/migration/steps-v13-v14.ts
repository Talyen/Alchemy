import { isRecord, migrateRunTree, rngSeedFromRun } from "./types";
import type { RawSaveData } from "./types";
import { createSeededRng } from "@/lib/utils";
import { generateLabyrinthMap } from "@/lib/content-systems/labyrinth/map-generation";

function isHexLabyrinthMap(value: unknown): boolean {
  return isRecord(value) && Array.isArray(value.floors) && isRecord(value.nodes);
}

function migrateRun(value: unknown): unknown {
  if (!isRecord(value) || value.contentSystemType !== "labyrinth") return value;
  if (isHexLabyrinthMap(value.labyrinthMap)) {
    return {
      ...value,
      labyrinthPendingNode: typeof value.labyrinthPendingNode === "string" ? value.labyrinthPendingNode : null,
    };
  }
  return {
    ...value,
    labyrinthMap: generateLabyrinthMap(createSeededRng(rngSeedFromRun(value))),
    labyrinthPendingNode: null,
  };
}

export function migrateV13ToV14(parsed: RawSaveData): RawSaveData {
  return migrateRunTree(parsed, migrateRun);
}
