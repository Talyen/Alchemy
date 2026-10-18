import { toActiveRunData } from "@/lib/validation";
import { getBattleOutcome } from "@/lib/battle";
import {
  SaveDataSchema,
  isCombatGoldOverride,
  safeParseWithErrors,
  getCandidateSavedAt,
  getSaveCompatibility,
  type ParsedSaveData,
} from "@/lib/validation";
import { createDefaultSaveData } from "./defaults";
import { logStorageFailure } from "@/lib/storage-logging";
import { isRecord } from "@/lib/utils";
import type { SaveData } from "./types";

type SaveLoadStatus =
  | { kind: "ok"; warnings?: string[] }
  | { kind: "unavailable" }
  | { kind: "unsupported-newer-schema"; detectedSchemaVersion: number }
  | { kind: "unsupported-newer-content"; detectedContentVersion: number }
  | { kind: "corrupt" };

export type SaveRestoreAction = "abandon-active-run";

export interface SaveLoadState {
  restoreActions?: readonly SaveRestoreAction[];
  importedDemoProgress?: boolean;
  data: SaveData;
  status: SaveLoadStatus;
}

function recordValues(value: unknown): unknown[] {
  return isRecord(value) ? Object.values(value) : [];
}

function isEmptyGearLike(value: unknown): boolean {
  return (
    isRecord(value) &&
    recordValues(value).every((entry) => entry === undefined || (Array.isArray(entry) && entry.length === 0))
  );
}

function isEmptyGearInventories(value: ParsedSaveData["gearInventories"]): boolean {
  return Object.values(value).every((entry) => entry.length === 0);
}

function sumInventoryValues(value: unknown): number {
  let total = 0;
  for (const entry of recordValues(value)) {
    if (typeof entry === "number" && Number.isFinite(entry) && entry > 0) total += entry;
  }
  return total;
}

function collectSaveRepairWarnings(raw: Record<string, unknown>, normalized: ParsedSaveData): string[] {
  const warnings: string[] = [];
  if (raw.activeRun && !normalized.activeRun) {
    warnings.push("active run could not be restored");
  }
  const rawActiveRun = isRecord(raw.activeRun) ? raw.activeRun : undefined;
  if (
    recordActivity(rawActiveRun).kind === "battle" &&
    normalized.activeRun &&
    normalized.activeRun.activity.kind !== "battle"
  ) {
    warnings.push("battle could not be restored");
  }
  const rawGold = raw.gold;
  // Live combat gold intentionally overrides the purse in SaveDataSchema;
  // that override is not a repair.
  const rawActivity = recordActivity(rawActiveRun);
  const rawCombatCandidate = rawActivity.kind === "battle" ? rawActivity.data : undefined;
  const rawCombat = isRecord(rawCombatCandidate) ? rawCombatCandidate : undefined;
  const rawBattleCandidate = rawCombat?.battleState;
  const rawBattle = isRecord(rawBattleCandidate) ? rawBattleCandidate : undefined;
  const rawCombatGold = rawBattle?.gold;
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
  for (const [field, label] of [
    ["craftingCurrencies", "crafting currencies"],
    ["materialInventory", "homestead materials"],
  ] as const) {
    const original = raw[field];
    if (
      original !== undefined &&
      sumInventoryValues(normalized[field]) === 0 &&
      (sumInventoryValues(original) > 0 || !isRecord(original))
    ) {
      warnings.push(`${label} could not be fully restored`);
    }
  }
  return warnings;
}

function recordActivity(run: Record<string, unknown> | undefined): Record<string, unknown> {
  return isRecord(run?.activity) ? run.activity : {};
}

export interface SaveCandidateSelection {
  state: SaveLoadState;
  /** Ordered write attempts, including only compatibility-permitted fallback slots. */
  writeSlots: ReadonlyArray<"primary" | "recovery">;
}

/** Select progress and its safe write slot from the same compatibility pass. */
export function selectSaveCandidates(
  primary: readonly string[],
  recovery: readonly string[] = [],
): SaveCandidateSelection {
  let future: { status: SaveLoadStatus; savedAt: number } | null = null;
  let playable: {
    raw: Record<string, unknown>;
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

      const compatibility = getSaveCompatibility(parsed);
      if (compatibility.kind === "unsupported-newer-schema" || compatibility.kind === "unsupported-newer-content") {
        futureSlots.add(slot);
        const savedAt = getCandidateSavedAt(parsed, -1);
        if (!future || savedAt > future.savedAt) future = { status: compatibility, savedAt };
        continue;
      }
      if (!isRecord(parsed)) {
        logStorageFailure("Save candidate root was not an object, trying next candidate");
        continue;
      }
      // Disposable formats stay silent and cannot acquire current defaults.
      if (compatibility.kind === "retired") continue;
      // Timestamp normalization matches the schema. Ties retain read order;
      // candidates that cannot win need no expensive validation.
      if (playable && getCandidateSavedAt(parsed, 0) <= playable.data.lastSavedAt) continue;
      const result = safeParseWithErrors(SaveDataSchema, parsed);
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
    const activity = playable.data.activeRun?.activity;
    const unfinishedTurn =
      activity?.kind === "battle" &&
      activity.data.battleState.turnPhase === "enemy" &&
      getBattleOutcome(activity.data.battleState) === null;
    state = {
      ...(unfinishedTurn ? { restoreActions: ["abandon-active-run" as const] } : {}),
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
    writeSlots: futureSlots.has("primary")
      ? ["recovery"]
      : futureSlots.has("recovery")
        ? ["primary"]
        : recovery.length > 0
          ? ["recovery"]
          : ["primary", "recovery"],
  };
}

/** Single-source validation used by headless careers and save contract tests. */
export function evaluateSaveCandidates(candidates: string[]): SaveLoadState {
  return selectSaveCandidates(candidates).state;
}
