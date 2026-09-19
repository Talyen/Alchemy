import { CURRENT_CONTENT_VERSION, CURRENT_SAVE_SCHEMA_VERSION } from "../metadata";
import { toFiniteNonNegativeInt } from "../save-schemas/validation-utils";

// Raw version readers for load gating. Sole consumer is
// storage/save-candidates.ts#getFutureSaveStatus, which applies schema-first
// precedence and freshness comparison; see MIGRATIONS.md future-schema saves.
function readRawField(parsed: unknown, key: string): unknown {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;
  return (parsed as Record<string, unknown>)[key];
}

function getRawVersion(parsed: unknown, key: string): number {
  const value = readRawField(parsed, key);
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
}

export function getRawSaveSchemaVersion(parsed: unknown): number {
  return getRawVersion(parsed, "saveSchemaVersion");
}
export function getRawContentVersion(parsed: unknown): number {
  return getRawVersion(parsed, "contentVersion");
}
function getRawLastSavedAt(parsed: unknown): number | null {
  // Timestamps have their own reader: like versions they must be finite and
  // non-negative, but fractional values floor instead of rejecting so a
  // hand-written float still orders sanely. SaveDataSchema.lastSavedAt shares
  // this normalizer via preprocess, so raw future-protection ordering and
  // parsed playable ordering agree. Never reuse the combat-gold
  // predicate here; the domains only coincide by accident.
  const value = readRawField(parsed, "lastSavedAt");
  return toFiniteNonNegativeInt(value);
}

// Single missing-timestamp policy for candidate ordering: absent or
// non-numeric timestamps fall back per domain (future: -1 so a timestamp-less
// future loses to any timestamped playable; playable pre-filter: 0 matching
// the schema catch default). Fractional values floor via getRawLastSavedAt.
export function getCandidateSavedAt(parsed: unknown, fallback: number): number {
  return getRawLastSavedAt(parsed) ?? fallback;
}

export function isUnsupportedFutureSaveData(parsed: unknown): boolean {
  return getRawSaveSchemaVersion(parsed) > CURRENT_SAVE_SCHEMA_VERSION;
}
export function isUnsupportedFutureContentData(parsed: unknown): boolean {
  return getRawContentVersion(parsed) > CURRENT_CONTENT_VERSION;
}
