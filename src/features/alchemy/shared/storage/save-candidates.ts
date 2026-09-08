import { toActiveRunData } from "@/lib/active-run-session";
import {
  SaveDataSchema,
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

function countParkedRuns(value: unknown): number {
  if (!value || typeof value !== "object" || Array.isArray(value)) return 0;
  return Object.keys(value).length;
}

function collectSaveRepairWarnings(raw: Partial<SaveData>, normalized: ParsedSaveData): string[] {
  const warnings: string[] = [];
  if (raw.activeRun && !normalized.activeRun) {
    warnings.push("active run could not be restored");
  }
  if (countParkedRuns(raw.parkedRuns) > countParkedRuns(normalized.parkedRuns)) {
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
      parkedRuns: hydrateParkedRuns(bestData.parkedRuns),
    };
    playable = { data: hydrated, status: warnings.length > 0 ? { kind: "ok", warnings } : { kind: "ok" } };
  }
  const future: SaveLoadState | null = futureStatus ? { data: createDefaultSaveData(), status: futureStatus } : null;

  if (future && (!playable || newestFutureSavedAt > playableSavedAt)) return future;
  if (playable) return playable;
  if (future) return future;
  return { data: createDefaultSaveData(), status: { kind: "corrupt" } };
}
