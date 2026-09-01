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

export function migrateParkedRuns(
  value: unknown,
  migrateRun: (run: unknown) => unknown,
): Record<string, unknown> | unknown {
  if (!isRecord(value)) return value;
  const next: Record<string, unknown> = {};
  for (const [mode, run] of Object.entries(value)) {
    next[mode] = migrateRun(run);
  }
  return next;
}

export function rngSeedFromRun(run: Record<string, unknown>): number {
  if (isRecord(run.rng) && typeof run.rng.seed === "number") return run.rng.seed >>> 0;
  return 1;
}
