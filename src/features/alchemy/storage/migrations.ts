// Save normalization and migration helpers for legacy or partial localStorage payloads.
// Depends on current game data, battle health defaults, homestead IDs, and save defaults.
import { characters, type BattleCard, type CharacterId } from "@/lib/game-data";
import { maxPlayerHealth } from "@/lib/battle";
import type { TalentXP } from "@/lib/talents";
import type { BuildingId, FarmId, MaterialInventory, ResearchId } from "@/lib/homestead/types";

import type { UnlockedTalents } from "../talent-pool";
import type { DisplayMode, UiScale } from "../types";
import type { ActiveRunData } from "../use-run-state";
import { defaultSaveData, type SaveData } from "./types";

// Character IDs are persisted, so renamed or invalid IDs need explicit guarding before hydration.
function isValidCharacterId(id: string): id is CharacterId {
  return id === "knight" || id === "ranger" || id === "rogue" || id === "wizard";
}

// Active runs are sanitized before hydration because localStorage can contain stale
// character IDs, renamed heroes, missing route fields, or hand-edited invalid payloads.
export function normalizeActiveRun(activeRun: unknown): ActiveRunData | null {
  if (!activeRun || typeof activeRun !== "object") {
    return null;
  }

  const candidate = activeRun as Record<string, unknown>;
  const rawCharacterId = candidate.characterId === "sorcerer" ? "wizard" : candidate.characterId === "warden" ? "ranger" : candidate.characterId;
  const characterId = typeof rawCharacterId === "string" && isValidCharacterId(rawCharacterId) ? rawCharacterId : null;
  if (!characterId) {
    return null;
  }

  const runDeck = Array.isArray(candidate.runDeck) && candidate.runDeck.length > 0 ? candidate.runDeck as BattleCard[] : [...characters[characterId].startingDeck];
  const runGold = typeof candidate.runGold === "number" ? candidate.runGold : 0;
  const runPlayerHealth = typeof candidate.runPlayerHealth === "number" ? candidate.runPlayerHealth : maxPlayerHealth;
  const runMaxHealth = typeof candidate.runMaxHealth === "number" ? candidate.runMaxHealth : maxPlayerHealth;
  const roomsEncountered = typeof candidate.roomsEncountered === "number" ? candidate.roomsEncountered : 0;
  const currentAct = typeof candidate.currentAct === "number" ? candidate.currentAct : 1;
  const destinationIndexInAct = typeof candidate.destinationIndexInAct === "number" ? candidate.destinationIndexInAct : 0;
  const completedDestinations = Array.isArray(candidate.completedDestinations) ? candidate.completedDestinations as string[] : [];
  const runTrinkets = Array.isArray(candidate.runTrinkets) ? candidate.runTrinkets as string[] : [];

  return {
    characterId,
    runDeck,
    runGold,
    runPlayerHealth,
    runMaxHealth,
    roomsEncountered,
    currentAct,
    destinationIndexInAct,
    completedDestinations,
    runTrinkets,
  };
}

// Normalize each field independently so one corrupt/old value falls back without wiping
// unrelated permanent progress such as discoveries or homestead materials.
export function normalizeSaveData(parsed: Partial<SaveData>): SaveData {
  return {
    selectedResolution: parsed.selectedResolution ?? defaultSaveData.selectedResolution,
    displayMode: normalizeDisplayMode(parsed.displayMode),
    uiScale: normalizeUiScale(parsed.uiScale),
    discoveredCardIds: Array.isArray(parsed.discoveredCardIds) ? parsed.discoveredCardIds : defaultSaveData.discoveredCardIds,
    encounteredEnemyIds: Array.isArray(parsed.encounteredEnemyIds) ? parsed.encounteredEnemyIds : defaultSaveData.encounteredEnemyIds,
    discoveredTrinketIds: Array.isArray(parsed.discoveredTrinketIds) ? parsed.discoveredTrinketIds : defaultSaveData.discoveredTrinketIds,
    talentXP: typeof parsed.talentXP === "object" && parsed.talentXP ? parsed.talentXP as TalentXP : defaultSaveData.talentXP,
    unlockedTalents: typeof parsed.unlockedTalents === "object" && parsed.unlockedTalents ? parsed.unlockedTalents as UnlockedTalents : defaultSaveData.unlockedTalents,
    musicVolume: typeof parsed.musicVolume === "number" ? parsed.musicVolume : defaultSaveData.musicVolume,
    sfxVolume: typeof parsed.sfxVolume === "number" ? parsed.sfxVolume : defaultSaveData.sfxVolume,
    masterVolume: typeof parsed.masterVolume === "number" ? parsed.masterVolume : defaultSaveData.masterVolume,
    muteInBackground: typeof parsed.muteInBackground === "boolean" ? parsed.muteInBackground : defaultSaveData.muteInBackground,
    autoEndTurn: typeof parsed.autoEndTurn === "boolean" ? parsed.autoEndTurn : defaultSaveData.autoEndTurn,
    brightness: typeof parsed.brightness === "number" ? parsed.brightness : defaultSaveData.brightness,
    activeRun: normalizeActiveRun(parsed.activeRun),
    materialInventory: migrateMaterialInventory(parsed.materialInventory),
    constructedBuildings: migrateBuildingIds(parsed.constructedBuildings),
    plantedFarms: migrateFarmIds(parsed.plantedFarms),
    completedResearch: Array.isArray(parsed.completedResearch) ? parsed.completedResearch as ResearchId[] : defaultSaveData.completedResearch,
  };
}

// Display mode is platform-facing, so unknown persisted values fall back to the default mode.
export function normalizeDisplayMode(displayMode: unknown): DisplayMode {
  if (displayMode === "windowed" || displayMode === "borderless-fullscreen" || displayMode === "fullscreen") {
    return displayMode;
  }

  return defaultSaveData.displayMode;
}

// UI scale is persisted as a string percentage and must stay within supported option values.
export function normalizeUiScale(uiScale: unknown): UiScale {
  if (uiScale === "90" || uiScale === "100" || uiScale === "110" || uiScale === "120") {
    return uiScale;
  }

  return defaultSaveData.uiScale;
}

// Rebuild key-by-key so saves from before a material existed receive a zero default while
// preserving any resources the player had already earned.
export function migrateMaterialInventory(inv: unknown): MaterialInventory {
  if (!inv || typeof inv !== "object") return defaultSaveData.materialInventory;
  const old = inv as Record<string, number>;
  return {
    wood: old.wood ?? 0,
    iron: old.iron ?? 0,
    herbs: old.herbs ?? 0,
    food: old.food ?? 0,
    crystal: old.crystal ?? 0,
  };
}

// Content IDs are part of persisted progress, so legacy names are remapped on load instead
// of forcing players to rebuild renamed structures.
export function migrateBuildingIds(ids: unknown): BuildingId[] {
  if (!Array.isArray(ids)) return defaultSaveData.constructedBuildings;
  return ids.map((id) => {
    if (id === "smithy") return "blacksmiths-forge" as BuildingId;
    return id as BuildingId;
  });
}

// Farm plots follow the same persisted-ID migration rule as buildings: renamed farm content
// should keep its planted/completed state across versions.
export function migrateFarmIds(ids: unknown): FarmId[] {
  if (!Array.isArray(ids)) return defaultSaveData.plantedFarms;
  return ids.map((id) => {
    if (id === "sheep-pasture") return "pasture" as FarmId;
    return id as FarmId;
  });
}
