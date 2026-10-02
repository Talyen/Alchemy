import { toActiveRunData } from "@/lib/active-run-session";
import {
  SaveDataSchema,
  LAUNCH_SAVE_SCHEMA_VERSION,
  isCombatGoldOverride,
  safeParseWithErrors,
  getCandidateSavedAt,
  getRawContentVersion,
  getRawSaveSchemaVersion,
  isUnsupportedFutureContentData,
  isUnsupportedFutureSaveData,
  migrateSupportedSaveData,
  type ParsedSaveData,
} from "@/lib/validation";
import { createDefaultSaveData } from "./defaults";
import { logStorageFailure } from "@/lib/storage-logging";
import type { SaveData } from "./types";

type SaveLoadStatus =
  | { kind: "ok"; warnings?: string[] }
  | { kind: "unavailable" }
  | { kind: "unsupported-newer-schema"; detectedSchemaVersion: number }
  | { kind: "unsupported-newer-content"; detectedContentVersion: number }
  | { kind: "corrupt" };

export interface SaveLoadState {
  importedDemoProgress?: boolean;
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
  if (raw.activeRun?.activeCombat != null && normalized.activeRun && !normalized.activeRun.activeCombat) {
    warnings.push("battle could not be restored");
  }
  const rawGold = (raw as { gold?: unknown }).gold;
  // Live combat gold intentionally overrides the purse (see SaveDataSchema
  // resolvePersistedGold); that override is not a repair.
  const rawCombatGold = (raw as { activeRun?: { activeCombat?: { battleState?: { gold?: unknown } } } }).activeRun
    ?.activeCombat?.battleState?.gold;
  if (rawGold !== undefined && rawGold !== normalized.gold && !isCombatGoldOverride(rawCombatGold, normalized.gold)) {
    warnings.push(`Field "gold" was repaired (raw ${JSON.stringify(rawGold)} -> ${normalized.gold})`);
  }
  // Zod catches damaged inventories with empty defaults. Only warn when
  // that reset discarded nonempty raw data; fresh and already-empty saves stay silent.
  if (
    raw.gearInventories !== undefined &&
    !isEmptyGearLike(raw.gearInventories) &&
    isEmptyGearInventories(normalized.gearInventories)
  ) {
    warnings.push("gear collection could not be fully restored");
  }
  if (
    raw.ownedTrinketIds !== undefined &&
    !(Array.isArray(raw.ownedTrinketIds) && raw.ownedTrinketIds.length === 0) &&
    normalized.ownedTrinketIds.length === 0
  ) {
    warnings.push("owned trinkets could not be fully restored");
  }
  if (
    raw.craftingCurrencies !== undefined &&
    sumInventoryValues(normalized.craftingCurrencies) === 0 &&
    (sumInventoryValues(raw.craftingCurrencies) > 0 || !isPlainObject(raw.craftingCurrencies))
  ) {
    warnings.push("crafting currencies could not be fully restored");
  }
  if (
    raw.materialInventory !== undefined &&
    sumInventoryValues(normalized.materialInventory) === 0 &&
    (sumInventoryValues(raw.materialInventory) > 0 || !isPlainObject(raw.materialInventory))
  ) {
    warnings.push("homestead materials could not be fully restored");
  }
  return warnings;
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

export interface SaveCandidateSelection {
  state: SaveLoadState;
  useRecovery: boolean;
}

/** Select progress and its safe write slot from the same compatibility pass. */
export function selectSaveCandidates(
  primary: readonly string[],
  recovery: readonly string[] = [],
): SaveCandidateSelection {
  let future: { status: SaveLoadStatus; savedAt: number } | null = null;
  let playable: {
    raw: Partial<SaveData>;
    data: ParsedSaveData;
    errors: Array<{ path: string; message: string }>;
  } | null = null;
  const futureSlots = new Set<string>();
  for (const [slot, candidates] of Object.entries({ primary, recovery })) {
    for (const candidate of candidates) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(candidate) as unknown;
      } catch (error) {
        logStorageFailure("Save candidate JSON parse failed, trying next candidate", error);
        continue;
      }

      const status = getFutureSaveStatus(parsed);
      if (status) {
        futureSlots.add(slot);
        const savedAt = getCandidateSavedAt(parsed, -1);
        if (!future || savedAt > future.savedAt) future = { status, savedAt };
        continue;
      }
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        logStorageFailure("Save candidate root was not an object, trying next candidate");
        continue;
      }
      // Disposable formats stay silent and cannot acquire current defaults.
      if (getRawSaveSchemaVersion(parsed) < LAUNCH_SAVE_SCHEMA_VERSION) continue;
      // Timestamp normalization matches the schema. Ties retain read order;
      // candidates that cannot win need no expensive validation.
      if (playable && getCandidateSavedAt(parsed, 0) <= playable.data.lastSavedAt) continue;
      const result = safeParseWithErrors(SaveDataSchema, migrateSupportedSaveData(parsed));
      if (!result.success) {
        logStorageFailure("Save candidate failed validation, trying next candidate", result.error);
        continue;
      }
      playable = { raw: parsed, data: result.data, errors: result.errors };
    }
  }

  let state: SaveLoadState;
  if (playable) {
    const warnings = collectSaveRepairWarnings(playable.raw, playable.data);
    for (const note of playable.errors) {
      warnings.push(`Card content "${note.path}" was repaired: ${note.message}`);
    }
    state = {
      data: {
        ...playable.data,
        activeRun: playable.data.activeRun ? toActiveRunData(playable.data.activeRun) : null,
      },
      status: warnings.length > 0 ? { kind: "ok", warnings } : { kind: "ok" },
    };
  } else {
    state = { data: createDefaultSaveData(), status: future?.status ?? { kind: "corrupt" } };
  }
  return {
    state,
    useRecovery: futureSlots.has("primary") || (recovery.length > 0 && !futureSlots.has("recovery")),
  };
}

/** Single-source validation used by headless careers and save contract tests. */
export function evaluateSaveCandidates(candidates: string[]): SaveLoadState {
  return selectSaveCandidates(candidates).state;
}
