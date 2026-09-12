import { CURRENT_CONTENT_VERSION, CURRENT_SAVE_SCHEMA_VERSION } from "../metadata";

function getRawVersion(parsed: unknown, key: string): number {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return 0;
  const value = (parsed as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
}

export function getRawSaveSchemaVersion(parsed: unknown): number {
  return getRawVersion(parsed, "saveSchemaVersion");
}
export function getRawContentVersion(parsed: unknown): number {
  return getRawVersion(parsed, "contentVersion");
}
export function getRawLastSavedAt(parsed: unknown): number | null {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const value = (parsed as Record<string, unknown>).lastSavedAt;
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

// The supported floor and current format coincide. Add only supported future transformations here.
export const SCHEMA_MIGRATIONS: Array<{
  from: number;
  to: number;
  migrate: (data: Record<string, unknown>) => Record<string, unknown>;
}> = [];

export function isUnsupportedFutureSaveData(parsed: unknown): boolean {
  return getRawSaveSchemaVersion(parsed) > CURRENT_SAVE_SCHEMA_VERSION;
}
export function isUnsupportedFutureContentData(parsed: unknown): boolean {
  return getRawContentVersion(parsed) > CURRENT_CONTENT_VERSION;
}
