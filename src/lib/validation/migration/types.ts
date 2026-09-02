import { hashStringToUint32 } from "@/lib/rng";

export type RawSaveData = Record<string, unknown>;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function getRawVersion(parsed: unknown, key: string): number {
  if (!parsed || typeof parsed !== "object") return 0;
  const version = (parsed as Record<string, unknown>)[key];
  if (typeof version !== "number" || !Number.isFinite(version) || !Number.isInteger(version) || version < 0) {
    return 0;
  }
  return version;
}

function migrateParkedRuns(value: unknown, migrateRun: (run: unknown) => unknown): unknown {
  if (!isRecord(value)) return value;
  const next: Record<string, unknown> = {};
  for (const [mode, run] of Object.entries(value)) {
    next[mode] = migrateRun(run);
  }
  return next;
}

export function migrateRunTree(save: RawSaveData, migrateRun: (run: unknown) => unknown): RawSaveData {
  return {
    ...save,
    activeRun: migrateRun(save.activeRun),
    parkedRuns: migrateParkedRuns(save.parkedRuns, migrateRun),
  };
}

export function rngSeedFromRun(run: Record<string, unknown>): number {
  if (isRecord(run.rng) && typeof run.rng.seed === "number") return run.rng.seed >>> 0;
  const runId = typeof run.runId === "string" ? run.runId : typeof run.id === "string" ? run.id : "";
  if (runId) {
    const hashed = hashStringToUint32(runId);
    if (hashed !== 0) return hashed;
  }
  if (typeof run.contentSystemType === "string" && typeof run.characterId === "string") {
    const fallback = hashStringToUint32(`${run.contentSystemType}:${run.characterId}`);
    if (fallback !== 0) return fallback;
  }
  return 1;
}
