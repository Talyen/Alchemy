import { toActiveRunData } from "@/lib/active-run-session";
import { logError } from "@/lib/error-logger";
import {
  SaveDataSchema,
  safeParseWithErrors,
  getRawContentVersion,
  getRawSaveSchemaVersion,
  isUnsupportedFutureContentData,
  isUnsupportedFutureSaveData,
  type ParsedSaveData,
} from "@/lib/validation";
import { defaultSaveData } from "./defaults";
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

export function fallbackSaveData(): SaveData {
  return structuredClone(defaultSaveData);
}

function logStorageFailure(message: string, error?: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-base-to-string -- preserve readable browser storage errors from unknown throws
  logError(message, "storage", error ? { error: String(error) } : undefined);
}

function collectSaveRepairWarnings(raw: Partial<SaveData>, normalized: ParsedSaveData): string[] {
  const warnings: string[] = [];
  if (raw.activeRun && !normalized.activeRun) {
    warnings.push("active run could not be restored");
  }
  const rawParked =
    raw &&
    typeof raw === "object" &&
    "parkedRuns" in raw &&
    raw.parkedRuns &&
    typeof raw.parkedRuns === "object" &&
    !Array.isArray(raw.parkedRuns)
      ? Object.keys(raw.parkedRuns).length
      : 0;
  const keptParked = Object.keys(normalized.parkedRuns ?? {}).length;
  if (rawParked > keptParked) {
    warnings.push("a parked run could not be restored");
  }
  const rawGold = (raw as { gold?: unknown }).gold;
  if (rawGold !== undefined && rawGold !== normalized.gold) {
    warnings.push(`Field "gold" was repaired (raw ${JSON.stringify(rawGold)} -> ${normalized.gold})`);
  }
  return warnings;
}

function hydrateActiveRunDeck(activeRun: ParsedSaveData["activeRun"]): SaveData["activeRun"] {
  if (!activeRun) return null;
  return toActiveRunData(activeRun);
}

function hydrateParkedRuns(parked: ParsedSaveData["parkedRuns"]): SaveData["parkedRuns"] {
  const next: SaveData["parkedRuns"] = {};
  for (const [mode, run] of Object.entries(parked)) {
    if (!run) continue;
    const hydrated = hydrateActiveRunDeck(run as ParsedSaveData["activeRun"]);
    if (hydrated) next[mode as keyof SaveData["parkedRuns"]] = hydrated;
  }
  return next;
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

function getRawLastSavedAt(parsed: unknown): number | null {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const value = (parsed as { lastSavedAt?: unknown }).lastSavedAt;
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

export function evaluateSaveCandidates(candidates: string[]): SaveLoadState {
  let future: SaveLoadState | null = null;
  let newestFutureSavedAt = -1;
  let playable: SaveLoadState | null = null;
  let playableSavedAt = 0;
  for (const candidate of candidates) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(candidate) as unknown;
    } catch (error) {
      logStorageFailure("Save candidate JSON parse failed, trying next candidate", error);
      continue;
    }

    const futureStatus = getFutureSaveStatus(parsed);
    if (futureStatus) {
      const savedAt = getRawLastSavedAt(parsed) ?? -1;
      if (savedAt > newestFutureSavedAt) newestFutureSavedAt = savedAt;
      future = { data: fallbackSaveData(), status: futureStatus };
      continue;
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      logStorageFailure("Save candidate root was not an object, trying next candidate");
      continue;
    }

    const result = safeParseWithErrors(SaveDataSchema, parsed);
    if (!result.success) {
      logStorageFailure("Save candidate failed validation, trying next candidate", result.error);
      continue;
    }
    if (!playable) {
      const data = result.data;
      const warnings = collectSaveRepairWarnings(parsed, data);
      for (const ve of result.errors) {
        warnings.push(`Field "${ve.path}" was corrupt: ${ve.message}`);
      }
      const hydrated: SaveData = {
        ...data,
        activeRun: hydrateActiveRunDeck(data.activeRun),
        parkedRuns: hydrateParkedRuns(data.parkedRuns),
      };
      if (warnings.length > 0) console.warn("Save data was normalized during load", warnings);
      playable = { data: hydrated, status: warnings.length > 0 ? { kind: "ok", warnings } : { kind: "ok" } };
      playableSavedAt = data.lastSavedAt;
    }
  }

  if (future && (!playable || newestFutureSavedAt > playableSavedAt)) return future;
  if (playable) return playable;
  if (future) return future;
  return { data: fallbackSaveData(), status: { kind: "corrupt" } };
}
