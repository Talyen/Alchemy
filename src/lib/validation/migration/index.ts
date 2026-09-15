import { CURRENT_CONTENT_VERSION, CURRENT_SAVE_SCHEMA_VERSION } from "../metadata";
import { isUsableLiveCombatGold } from "../save-schemas/validation-utils";

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
export function getRawLastSavedAt(parsed: unknown): number | null {
  const value = readRawField(parsed, "lastSavedAt");
  return isUsableLiveCombatGold(value) ? value : null;
}

export function isUnsupportedFutureSaveData(parsed: unknown): boolean {
  return getRawSaveSchemaVersion(parsed) > CURRENT_SAVE_SCHEMA_VERSION;
}
export function isUnsupportedFutureContentData(parsed: unknown): boolean {
  return getRawContentVersion(parsed) > CURRENT_CONTENT_VERSION;
}
