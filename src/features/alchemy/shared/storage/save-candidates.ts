import { toActiveRunData } from "@/lib/active-run-session";
import {
  SaveDataSchema,
  LAUNCH_SAVE_SCHEMA_VERSION,
  safeParseWithErrors,
  getRawContentVersion,
  getRawLastSavedAt,
  getRawSaveSchemaVersion,
  isUnsupportedFutureContentData,
  isUnsupportedFutureSaveData,
  type ParsedSaveData,
} from "@/lib/validation";
import { createDefaultSaveData } from "./defaults";
import { logStorageFailure } from "./save-logging";
import type { SaveData } from "./types";

type SaveLoadStatus =
  | { kind: "ok"; warnings?: string[] }
  | { kind: "unsupported-newer-schema"; detectedSchemaVersion: number }
  | { kind: "unsupported-newer-content"; detectedContentVersion: number }
  | { kind: "corrupt" };

export interface SaveLoadState {
  data: SaveData;
  status: SaveLoadStatus;
}

function isEmptyGearLike(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entries = Object.values(value as Record<string, unknown>);
  if (entries.length === 0) return true;
  return entries.every((entry) => entry === undefined || (Array.isArray(entry) && entry.length === 0));
}

function isEmptyGearInventories(value: ParsedSaveData["gearInventories"]): boolean {
  return Object.values(value).every((entry) => entry.length === 0);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function sumInventoryValues(value: unknown): number {
  if (!isPlainObject(value)) return 0;
  let total = 0;
  for (const entry of Object.values(value)) {
    if (typeof entry === "number" && Number.isFinite(entry) && entry > 0) total += entry;
  }
  return total;
}

function collectSaveRepairWarnings(raw: Partial<SaveData>, normalized: ParsedSaveData): string[] {
  const warnings: string[] = [];
  if (raw.activeRun && !normalized.activeRun) {
    warnings.push("active run could not be restored");
  }
  const rawGold = (raw as { gold?: unknown }).gold;
  if (rawGold !== undefined && rawGold !== normalized.gold) {
    warnings.push(`Field "gold" was repaired (raw ${JSON.stringify(rawGold)} -> ${normalized.gold})`);
  }
  // Zod `.catch()` silently resets corrupt sections to empty defaults, so a
  // damaged gear block would otherwise look like intentional loss. Warn only
  // when the raw payload held something beyond harmless defaults; absent or
  // already-empty fields stay silent so fresh saves do not warn.
  const rawGear = (raw as { gearInventories?: unknown }).gearInventories;
  if (rawGear !== undefined && !isEmptyGearLike(rawGear) && isEmptyGearInventories(normalized.gearInventories)) {
    warnings.push("gear collection could not be fully restored");
  }
  const rawTrinkets = (raw as { ownedTrinketIds?: unknown }).ownedTrinketIds;
  if (
    rawTrinkets !== undefined &&
    !(Array.isArray(rawTrinkets) && rawTrinkets.length === 0) &&
    normalized.ownedTrinketIds.length === 0
  ) {
    warnings.push("owned trinkets could not be fully restored");
  }
  const rawCurrencies = (raw as { craftingCurrencies?: unknown }).craftingCurrencies;
  if (
    rawCurrencies !== undefined &&
    sumInventoryValues(normalized.craftingCurrencies) === 0 &&
    (sumInventoryValues(rawCurrencies) > 0 || !isPlainObject(rawCurrencies))
  ) {
    warnings.push("crafting currencies could not be fully restored");
  }
  const rawMaterials = (raw as { materialInventory?: unknown }).materialInventory;
  if (
    rawMaterials !== undefined &&
    sumInventoryValues(normalized.materialInventory) === 0 &&
    (sumInventoryValues(rawMaterials) > 0 || !isPlainObject(rawMaterials))
  ) {
    warnings.push("homestead materials could not be fully restored");
  }
  return warnings;
}

function hydrateActiveRunDeck(activeRun: ParsedSaveData["activeRun"]): SaveData["activeRun"] {
  if (!activeRun) return null;
  return toActiveRunData(activeRun);
}

function getFutureSaveStatus(parsed: unknown): SaveLoadStatus | null {
  if (isUnsupportedFutureSaveData(parsed)) {
    return { kind: "unsupported-newer-schema", detectedSchemaVersion: getRawSaveSchemaVersion(parsed) };
  }
  if (isUnsupportedFutureContentData(parsed)) {
    return { kind: "unsupported-newer-content", detectedContentVersion: getRawContentVersion(parsed) };
  }
  return null;
}

export function evaluateSaveCandidates(candidates: string[]): SaveLoadState {
  let futureStatus: SaveLoadStatus | null = null;
  let newestFutureSavedAt = -1;
  let bestParsed: unknown = null;
  let bestData: ParsedSaveData | null = null;
  let bestErrors: Array<{ path: string; message: string }> = [];
  let playableSavedAt = 0;
  for (const candidate of candidates) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(candidate) as unknown;
    } catch (error) {
      logStorageFailure("Save candidate JSON parse failed, trying next candidate", error);
      continue;
    }

    const candidateFutureStatus = getFutureSaveStatus(parsed);
    if (candidateFutureStatus) {
      const savedAt = getRawLastSavedAt(parsed) ?? -1;
      if (savedAt >= newestFutureSavedAt) {
        newestFutureSavedAt = savedAt;
        futureStatus = candidateFutureStatus;
      }
      continue;
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      logStorageFailure("Save candidate root was not an object, trying next candidate");
      continue;
    }

    // Reject disposable formats before field defaults can stamp them as current.
    const detectedVersion = getRawSaveSchemaVersion(parsed);
    if (detectedVersion < LAUNCH_SAVE_SCHEMA_VERSION) {
      logStorageFailure(
        `Save candidate rejected: schema version ${detectedVersion} predates launch version ${LAUNCH_SAVE_SCHEMA_VERSION}, trying next candidate`,
      );
      continue;
    }
    const result = safeParseWithErrors(SaveDataSchema, parsed);
    if (!result.success) {
      logStorageFailure("Save candidate failed validation, trying next candidate", result.error);
      continue;
    }
    const data = result.data;
    if (!bestData || data.lastSavedAt > playableSavedAt) {
      bestParsed = parsed;
      bestData = data;
      bestErrors = result.errors;
      playableSavedAt = data.lastSavedAt;
    }
  }

  let playable: SaveLoadState | null = null;
  if (bestData) {
    const warnings = collectSaveRepairWarnings(bestParsed as Partial<SaveData>, bestData);
    for (const ve of bestErrors) {
      warnings.push(`Field "${ve.path}" was corrupt: ${ve.message}`);
    }
    const hydrated: SaveData = {
      ...bestData,
      activeRun: hydrateActiveRunDeck(bestData.activeRun),
    };
    playable = { data: hydrated, status: warnings.length > 0 ? { kind: "ok", warnings } : { kind: "ok" } };
  }
  const future: SaveLoadState | null = futureStatus ? { data: createDefaultSaveData(), status: futureStatus } : null;

  if (future && (!playable || newestFutureSavedAt > playableSavedAt)) return future;
  if (playable) return playable;
  return { data: createDefaultSaveData(), status: { kind: "corrupt" } };
}
