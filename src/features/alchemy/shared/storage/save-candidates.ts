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
  type ParsedSaveData,
} from "@/lib/validation";
import { createDefaultSaveData } from "./defaults";
import { logStorageFailure } from "@/lib/storage-logging";
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
  // Live combat gold intentionally overrides the purse (see SaveDataSchema
  // resolvePersistedGold); that override is not a repair.
  const rawCombatGold = (raw as { activeRun?: { activeCombat?: { battleState?: { gold?: unknown } } } }).activeRun
    ?.activeCombat?.battleState?.gold;
  if (rawGold !== undefined && rawGold !== normalized.gold && !isCombatGoldOverride(rawCombatGold, normalized.gold)) {
    warnings.push(`Field "gold" was repaired (raw ${JSON.stringify(rawGold)} -> ${normalized.gold})`);
  }
  // Zod `.catch()` silently resets corrupt sections to empty defaults, so a
  // damaged block would otherwise look like intentional loss. Warn only when
  // the raw payload held something beyond harmless defaults; absent or
  // already-empty fields stay silent so fresh saves do not warn. New
  // inventories add one row here, not a new branch plus helper.
  const rawInventories = raw as {
    gearInventories?: unknown;
    ownedTrinketIds?: unknown;
    craftingCurrencies?: unknown;
    materialInventory?: unknown;
  };
  const inventoryChecks: Array<{ damaged: boolean; message: string }> = [
    {
      message: "gear collection could not be fully restored",
      damaged:
        rawInventories.gearInventories !== undefined &&
        !isEmptyGearLike(rawInventories.gearInventories) &&
        isEmptyGearInventories(normalized.gearInventories),
    },
    {
      message: "owned trinkets could not be fully restored",
      damaged:
        rawInventories.ownedTrinketIds !== undefined &&
        !(Array.isArray(rawInventories.ownedTrinketIds) && rawInventories.ownedTrinketIds.length === 0) &&
        normalized.ownedTrinketIds.length === 0,
    },
    {
      message: "crafting currencies could not be fully restored",
      damaged:
        rawInventories.craftingCurrencies !== undefined &&
        sumInventoryValues(normalized.craftingCurrencies) === 0 &&
        (sumInventoryValues(rawInventories.craftingCurrencies) > 0 ||
          !isPlainObject(rawInventories.craftingCurrencies)),
    },
    {
      message: "homestead materials could not be fully restored",
      damaged:
        rawInventories.materialInventory !== undefined &&
        sumInventoryValues(normalized.materialInventory) === 0 &&
        (sumInventoryValues(rawInventories.materialInventory) > 0 || !isPlainObject(rawInventories.materialInventory)),
    },
  ];
  for (const check of inventoryChecks) {
    if (check.damaged) warnings.push(check.message);
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

export function evaluateSaveCandidates(candidates: string[]): SaveLoadState {
  let futureStatus: SaveLoadStatus | null = null;
  let newestFutureSavedAt = -1;
  let bestParsed: unknown = null;
  let bestData: ParsedSaveData | null = null;
  let nestedCardWarnings: Array<{ path: string; message: string }> = [];
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
      const savedAt = getCandidateSavedAt(parsed, -1);
      // First-wins on ties, matching the playable-vs-playable tie-break
      // below: recency across future kinds (schema vs content) still decides,
      // but equal timestamps keep the earlier candidate in read order.
      if (futureStatus === null || savedAt > newestFutureSavedAt) {
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
    // Stays silent: empty or missing candidates on fresh profiles are routine,
    // and logStorageFailure feeds the error sink asserted empty by E2E journeys.
    if (getRawSaveSchemaVersion(parsed) < LAUNCH_SAVE_SCHEMA_VERSION) continue;
    // Cheap pre-filter: the shared timestamp normalizer guarantees a
    // successful parse yields exactly this value, so a candidate that cannot
    // beat the current best (or tie-break it) skips the full Zod parse.
    // The first valid candidate and any potential winner are always parsed,
    // so validation diagnostics for the loaded save are preserved.
    if (bestData && getCandidateSavedAt(parsed, 0) <= playableSavedAt) continue;
    const result = safeParseWithErrors(SaveDataSchema, parsed);
    // Defensive: nearly every SaveDataSchema field carries `.catch`, so any
    // object passing the baseline above parses successfully and this branch
    // is effectively unreachable. Kept so a future strict field cannot
    // promote a corrupt candidate to playable.
    if (!result.success) {
      logStorageFailure("Save candidate failed validation, trying next candidate", result.error);
      continue;
    }
    const data = result.data;
    if (!bestData || data.lastSavedAt > playableSavedAt) {
      bestParsed = parsed;
      bestData = data;
      nestedCardWarnings = result.errors;
      playableSavedAt = data.lastSavedAt;
    }
  }

  let playable: SaveLoadState | null = null;
  if (bestData) {
    const warnings = collectSaveRepairWarnings(bestParsed as Partial<SaveData>, bestData);
    // Nested card-content repair notes (e.g. dropped effects/descriptions),
    // not corrupt top-level fields: safeParseWithErrors only returns these on
    // success, so phrase them as repairs.
    for (const note of nestedCardWarnings) {
      warnings.push(`Card content "${note.path}" was repaired: ${note.message}`);
    }
    const hydrated: SaveData = {
      ...bestData,
      activeRun: bestData.activeRun ? toActiveRunData(bestData.activeRun) : null,
    };
    playable = { data: hydrated, status: warnings.length > 0 ? { kind: "ok", warnings } : { kind: "ok" } };
  }
  const future: SaveLoadState | null = futureStatus ? { data: createDefaultSaveData(), status: futureStatus } : null;

  if (future && (!playable || newestFutureSavedAt > playableSavedAt)) return future;
  if (playable) return playable;
  return { data: createDefaultSaveData(), status: { kind: "corrupt" } };
}
