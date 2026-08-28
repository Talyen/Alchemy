import type { RawSaveData } from "./types";
import { createSeededRng } from "@/lib/utils";
import { generateLabyrinthMap } from "@/lib/content-systems/labyrinth/map-generation";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isHexLabyrinthMap(value: unknown): boolean {
  return isRecord(value) && Array.isArray(value.floors) && isRecord(value.nodes);
}

function rngSeedFromRun(run: Record<string, unknown>): number {
  if (isRecord(run.rng) && typeof run.rng.seed === "number") return run.rng.seed >>> 0;
  return 1;
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

function migrateParkedRuns(value: unknown): unknown {
  if (!isRecord(value)) return value;
  const next: Record<string, unknown> = {};
  for (const [key, run] of Object.entries(value)) {
    next[key] = migrateRun(run);
  }
  return next;
}

export function migrateV13ToV14(parsed: RawSaveData): RawSaveData {
  return {
    ...parsed,
    activeRun: migrateRun(parsed.activeRun),
    parkedRuns: migrateParkedRuns(parsed.parkedRuns),
  };
}
