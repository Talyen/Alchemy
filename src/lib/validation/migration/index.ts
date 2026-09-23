import { CURRENT_CONTENT_VERSION, CURRENT_SAVE_SCHEMA_VERSION } from "../metadata";
import { toFiniteNonNegativeInt } from "../save-schemas/validation-utils";
import { applyLabyrinthMysteryModifiers } from "@/lib/content-systems/labyrinth/room-rules";
import type { EncounterRewardTraitId } from "@/lib/content-systems/encounter-traits";
import { findMysteryEvent } from "@/lib/mystery";
import { applyResolvedMysteryTrinketIds } from "@/lib/mystery/resolve-trinkets";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function migrateVersion19(save: Record<string, unknown>): Record<string, unknown> {
  const activeRun = save.activeRun;
  if (!isRecord(activeRun) || !isRecord(activeRun.mysteryVisit)) return { ...save, saveSchemaVersion: 20 };
  const visit = activeRun.mysteryVisit;
  const poolEvent = typeof visit.eventId === "string" ? findMysteryEvent(visit.eventId) : null;
  if (!poolEvent) {
    return {
      ...save,
      saveSchemaVersion: 20,
      activeRun: { ...activeRun, currentScreen: activeRun.currentScreen ?? "mystery", mysteryVisit: null },
    };
  }
  const resolvedIds = Array.isArray(visit.resolvedTrinketIds)
    ? visit.resolvedTrinketIds.filter((id): id is string => typeof id === "string")
    : [];
  const combat = isRecord(activeRun.activeCombat) ? activeRun.activeCombat : null;
  const topLevelModifiers = activeRun.activeLabyrinthRewardModifiers;
  const combatModifiers = combat?.activeLabyrinthRewardModifiers;
  const savedModifiers =
    Array.isArray(topLevelModifiers) && topLevelModifiers.length > 0 ? topLevelModifiers : combatModifiers;
  const modifiers =
    activeRun.contentSystemType === "labyrinth" && Array.isArray(savedModifiers)
      ? savedModifiers.filter((id): id is EncounterRewardTraitId => typeof id === "string")
      : [];
  const maxHealth =
    typeof activeRun.runMaxHealth === "number" && Number.isFinite(activeRun.runMaxHealth) ? activeRun.runMaxHealth : 0;
  const event = applyLabyrinthMysteryModifiers(
    applyResolvedMysteryTrinketIds(poolEvent, resolvedIds),
    modifiers,
    maxHealth,
  );
  const { eventId: _eventId, resolvedTrinketIds: _resolvedTrinketIds, ...remainingVisit } = visit;
  return {
    ...save,
    saveSchemaVersion: 20,
    activeRun: { ...activeRun, mysteryVisit: { ...remainingVisit, event } },
  };
}

const saveMigrations: Record<number, (save: Record<string, unknown>) => Record<string, unknown>> = {
  19: migrateVersion19,
};

export function migrateSupportedSaveData(raw: unknown): unknown {
  if (!isRecord(raw)) return raw;
  let save = raw;
  for (let version = getRawSaveSchemaVersion(raw); version < CURRENT_SAVE_SCHEMA_VERSION; version++) {
    const migrate = saveMigrations[version];
    if (!migrate) throw new Error(`Missing save migration for schema ${version}`);
    save = migrate(save);
  }
  return save;
}

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
