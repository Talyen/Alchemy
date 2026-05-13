// Save normalization and migration helpers for legacy or partial localStorage payloads.
// Depends on domain-specific migration helpers and save defaults.
import type { TalentXP } from "@/lib/talents";
import type { ResearchId } from "@/lib/homestead/types";

import type { UnlockedTalents } from "../talent-pool";
import { normalizeActiveRun } from "./active-run";
import { migrateBuildingIds, migrateFarmIds, migrateMaterialInventory } from "./homestead";
import { normalizeDisplayMode, normalizeUiScale } from "./options";
import { defaultSaveData, type SaveData } from "./types";

export { normalizeActiveRun } from "./active-run";
export { migrateBuildingIds, migrateFarmIds, migrateMaterialInventory } from "./homestead";
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
    constructedBuildings: migrateBuildingIds(parsed.constructedBuildings),
    plantedFarms: migrateFarmIds(parsed.plantedFarms),
    completedResearch: Array.isArray(parsed.completedResearch)
      ? (parsed.completedResearch as ResearchId[])
      : defaultSaveData.completedResearch,
  };
}
