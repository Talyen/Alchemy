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

export { normalizeActiveRun } from "./active-run";
export { migrateBuildingIds, migrateFarmIds, migrateMaterialInventory, migrateToTierLevels } from "./homestead";
export { normalizeDisplayMode, normalizeUiScale } from "./options";

// Normalize each field independently so one corrupt/old value falls back without wiping
// unrelated permanent progress such as discoveries or homestead materials.
export function normalizeSaveData(parsed: Partial<SaveData>): SaveData {
  return {
    selectedResolution: parsed.selectedResolution ?? defaultSaveData.selectedResolution,
    displayMode: normalizeDisplayMode(parsed.displayMode),
    uiScale: normalizeUiScale(parsed.uiScale),
    discoveredCardIds: Array.isArray(parsed.discoveredCardIds)
      ? parsed.discoveredCardIds
      : defaultSaveData.discoveredCardIds,
    encounteredEnemyIds: Array.isArray(parsed.encounteredEnemyIds)
      ? parsed.encounteredEnemyIds
      : defaultSaveData.encounteredEnemyIds,
    discoveredTrinketIds: Array.isArray(parsed.discoveredTrinketIds)
      ? parsed.discoveredTrinketIds
      : defaultSaveData.discoveredTrinketIds,
    talentXP:
      typeof parsed.talentXP === "object" && parsed.talentXP ? (parsed.talentXP as TalentXP) : defaultSaveData.talentXP,
    unlockedTalents:
      typeof parsed.unlockedTalents === "object" && parsed.unlockedTalents
        ? (parsed.unlockedTalents as UnlockedTalents)
        : defaultSaveData.unlockedTalents,
    musicVolume: typeof parsed.musicVolume === "number" ? parsed.musicVolume : defaultSaveData.musicVolume,
    sfxVolume: typeof parsed.sfxVolume === "number" ? parsed.sfxVolume : defaultSaveData.sfxVolume,
    masterVolume: typeof parsed.masterVolume === "number" ? parsed.masterVolume : defaultSaveData.masterVolume,
    muteInBackground:
      typeof parsed.muteInBackground === "boolean" ? parsed.muteInBackground : defaultSaveData.muteInBackground,
    autoEndTurn: typeof parsed.autoEndTurn === "boolean" ? parsed.autoEndTurn : defaultSaveData.autoEndTurn,
    brightness: typeof parsed.brightness === "number" ? parsed.brightness : defaultSaveData.brightness,
    activeRun: normalizeActiveRun(parsed.activeRun),
    materialInventory: migrateMaterialInventory(parsed.materialInventory),
    constructedBuildings: migrateToTierLevels(
      parsed.constructedBuildings,
      buildings,
      { smithy: "blacksmiths-forge" },
    ) as Record<BuildingId, number>,
    plantedFarms: migrateToTierLevels(
      parsed.plantedFarms,
      farmPlots,
      { "sheep-pasture": "pasture" },
    ) as Record<FarmId, number>,
    completedResearch: migrateToTierLevels(
      parsed.completedResearch ?? defaultSaveData.completedResearch,
      researchUpgrades,
    ) as Record<ResearchId, number>,
    bondedCompanions: migrateToTierLevels(
      parsed.bondedCompanions ?? defaultSaveData.bondedCompanions,
      Object.keys(companionLibrary).map((id) => ({ id, tiers: [null, null, null] })),
    ) as Record<CompanionId, number>,
    completedDifficulties:
      typeof parsed.completedDifficulties === "object" && parsed.completedDifficulties
        ? (parsed.completedDifficulties as Record<CharacterId, DifficultyId[]>)
        : defaultSaveData.completedDifficulties,
  };
}
