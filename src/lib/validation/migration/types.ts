export type RawSaveData = Record<string, unknown>;

export function normalizePositiveInteger(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value) || value < 0) return fallback;
  return value;
}
