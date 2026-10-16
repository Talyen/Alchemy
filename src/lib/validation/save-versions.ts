import { CURRENT_CONTENT_VERSION, CURRENT_SAVE_SCHEMA_VERSION, LAUNCH_SAVE_SCHEMA_VERSION } from "./metadata";
import { toSafeNonNegativeInt } from "./save-schemas/validation-utils";

export type SaveCompatibility =
  | { kind: "supported" }
  | { kind: "retired" }
  | { kind: "unsupported-newer-schema"; detectedSchemaVersion: number }
  | { kind: "unsupported-newer-content"; detectedContentVersion: number };

function readRawField(parsed: unknown, key: string): unknown {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;
  return (parsed as Record<string, unknown>)[key];
}

function getRawVersion(parsed: unknown, key: string): number {
  const value = readRawField(parsed, key);
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
}

/** Protect future data before rejecting disposable development formats. */
export function getSaveCompatibility(parsed: unknown): SaveCompatibility {
  const schema = getRawVersion(parsed, "saveSchemaVersion");
  if (schema > CURRENT_SAVE_SCHEMA_VERSION) return { kind: "unsupported-newer-schema", detectedSchemaVersion: schema };
  const content = getRawVersion(parsed, "contentVersion");
  if (content > CURRENT_CONTENT_VERSION) return { kind: "unsupported-newer-content", detectedContentVersion: content };
  return { kind: schema < LAUNCH_SAVE_SCHEMA_VERSION ? "retired" : "supported" };
}

/** Match schema timestamp repair; future and playable candidates supply their own missing-value fallback. */
export function getCandidateSavedAt(parsed: unknown, fallback: number): number {
  return toSafeNonNegativeInt(readRawField(parsed, "lastSavedAt")) ?? fallback;
}
