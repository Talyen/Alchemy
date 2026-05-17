// Save normalization and migration helpers for legacy or partial localStorage payloads.
// Depends on domain-specific migration helpers and save defaults.
import type { TalentXP } from "@/lib/talents";
import type { BuildingId, FarmId, ResearchId } from "@/lib/homestead/types";
import { buildings, farmPlots, researchUpgrades } from "@/lib/homestead/data";
import { companionLibrary } from "@/lib/game-data";

import type { CharacterId, CompanionId, DifficultyId, UnlockedTalents } from "@/lib/game-data";
import { normalizeActiveRun } from "./active-run";
import { migrateMaterialInventory, migrateToTierLevels } from "./homestead";
import { normalizeDisplayMode, normalizeUiScale } from "./options";
import type { SaveData } from "./types";
import { defaultSaveData } from "./defaults";
import { CURRENT_CONTENT_VERSION, CURRENT_GAME_BUILD_VERSION, CURRENT_SAVE_SCHEMA_VERSION } from "./metadata";
import { resolutionOptions } from "../config/options";

export { normalizeActiveRun } from "./active-run";
export { migrateBuildingIds, migrateFarmIds, migrateMaterialInventory, migrateToTierLevels } from "./homestead";
export { normalizeDisplayMode, normalizeUiScale } from "./options";

const CHARACTER_IDS: CharacterId[] = ["knight", "rogue", "wizard", "ranger"];

type RawSaveData = Record<string, unknown>;

// Normalize each field independently so one corrupt/old value falls back without wiping
// unrelated permanent progress such as discoveries or homestead materials.
export function normalizeSaveData(parsed: Partial<SaveData> | RawSaveData): SaveData {
  const migrated = migrateSaveDataToCurrent(parsed);
  return {
    saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
    gameBuildVersion:
      typeof migrated.gameBuildVersion === "string" ? migrated.gameBuildVersion : CURRENT_GAME_BUILD_VERSION,
    contentVersion: normalizePositiveInteger(migrated.contentVersion, CURRENT_CONTENT_VERSION),
    selectedResolution: normalizeResolution(migrated.selectedResolution),
    displayMode: normalizeDisplayMode(migrated.displayMode),
    uiScale: normalizeUiScale(migrated.uiScale),
    discoveredCardIds: normalizeStringList(migrated.discoveredCardIds, defaultSaveData.discoveredCardIds),
    encounteredEnemyIds: normalizeStringList(migrated.encounteredEnemyIds, defaultSaveData.encounteredEnemyIds),
    discoveredTrinketIds: normalizeStringList(migrated.discoveredTrinketIds, defaultSaveData.discoveredTrinketIds),
    talentXP: normalizeTalentXP(migrated.talentXP),
    unlockedTalents: normalizeUnlockedTalents(migrated.unlockedTalents),
    musicVolume: normalizeBoundedNumber(migrated.musicVolume, defaultSaveData.musicVolume, 0, 100),
    sfxVolume: normalizeBoundedNumber(migrated.sfxVolume, defaultSaveData.sfxVolume, 0, 100),
    masterVolume: normalizeBoundedNumber(migrated.masterVolume, defaultSaveData.masterVolume, 0, 100),
    muteInBackground:
      typeof migrated.muteInBackground === "boolean" ? migrated.muteInBackground : defaultSaveData.muteInBackground,
    autoEndTurn: typeof migrated.autoEndTurn === "boolean" ? migrated.autoEndTurn : defaultSaveData.autoEndTurn,
    brightness: normalizeBoundedNumber(migrated.brightness, defaultSaveData.brightness, 50, 150),
    activeRun: normalizeActiveRun(migrated.activeRun),
    materialInventory: migrateMaterialInventory(migrated.materialInventory),
    constructedBuildings: migrateToTierLevels(migrated.constructedBuildings, buildings, {
      smithy: "blacksmiths-forge",
    }) as Record<BuildingId, number>,
    plantedFarms: migrateToTierLevels(migrated.plantedFarms, farmPlots, { "sheep-pasture": "pasture" }) as Record<
      FarmId,
      number
    >,
    completedResearch: migrateToTierLevels(
      migrated.completedResearch ?? defaultSaveData.completedResearch,
      researchUpgrades,
    ) as Record<ResearchId, number>,
    bondedCompanions: migrateToTierLevels(
      migrated.bondedCompanions ?? defaultSaveData.bondedCompanions,
      Object.keys(companionLibrary).map((id) => ({ id, tiers: [null, null, null] })),
    ) as Record<CompanionId, number>,
    completedDifficulties: normalizeCompletedDifficulties(migrated.completedDifficulties),
  };
}

// Runs known historical save shapes forward before field-level corruption cleanup.
export function migrateSaveDataToCurrent(parsed: unknown): RawSaveData {
  if (!parsed || typeof parsed !== "object") return {};
  let current = { ...(parsed as RawSaveData) };
  let version = getRawSaveSchemaVersion(current);

  if (version < 1) {
    current = migrateV0ToV1(current);
    version = 1;
  }

  return { ...current, saveSchemaVersion: version };
}

// Missing metadata means the save predates schema tracking and should migrate from v0.
export function getRawSaveSchemaVersion(parsed: unknown): number {
  if (!parsed || typeof parsed !== "object") return 0;
  const version = (parsed as RawSaveData).saveSchemaVersion;
  if (typeof version !== "number" || !Number.isFinite(version) || !Number.isInteger(version) || version < 0) return 0;
  return version;
}

function migrateV0ToV1(parsed: RawSaveData): RawSaveData {
  return {
    ...parsed,
    saveSchemaVersion: 1,
    gameBuildVersion:
      typeof parsed.gameBuildVersion === "string" ? parsed.gameBuildVersion : CURRENT_GAME_BUILD_VERSION,
    contentVersion: normalizePositiveInteger(parsed.contentVersion, CURRENT_CONTENT_VERSION),
  };
}

// Saves from newer schema versions should not be rewritten by older builds.
export function isUnsupportedFutureSaveData(parsed: unknown): boolean {
  return getRawSaveSchemaVersion(parsed) > CURRENT_SAVE_SCHEMA_VERSION;
}

function normalizeResolution(value: unknown): SaveData["selectedResolution"] {
  return resolutionOptions.some((option) => option.value === value)
    ? (value as SaveData["selectedResolution"])
    : defaultSaveData.selectedResolution;
}

function normalizeStringList(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  return [...new Set(value.filter((entry): entry is string => typeof entry === "string"))];
}

function normalizeBoundedNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function normalizePositiveInteger(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value) || value < 0) return fallback;
  return value;
}

function normalizeTalentXP(value: unknown): TalentXP {
  if (!value || typeof value !== "object") return defaultSaveData.talentXP;
  const result: Record<string, number> = {};
  for (const [keywordId, xp] of Object.entries(value)) {
    if (typeof xp === "number" && Number.isFinite(xp) && xp >= 0) {
      result[keywordId] = Math.floor(xp);
    }
  }
  return result as TalentXP;
}

function normalizeUnlockedTalents(value: unknown): UnlockedTalents {
  if (!value || typeof value !== "object") return defaultSaveData.unlockedTalents;
  const result: Record<string, string[]> = {};
  for (const [keywordId, talentIds] of Object.entries(value)) {
    if (!Array.isArray(talentIds)) continue;
    result[keywordId] = normalizeStringList(talentIds, []);
  }
  return result as UnlockedTalents;
}

function normalizeCompletedDifficulties(value: unknown): Record<CharacterId, DifficultyId[]> {
  const result: Record<string, string[]> = { ...defaultSaveData.completedDifficulties };
  if (!value || typeof value !== "object") return result as Record<CharacterId, DifficultyId[]>;
  for (const [characterId, difficultyIds] of Object.entries(value)) {
    result[characterId] = normalizeStringList(difficultyIds, []);
  }
  for (const characterId of CHARACTER_IDS) {
    result[characterId] = result[characterId] ?? [];
  }
  return result as Record<CharacterId, DifficultyId[]>;
}
