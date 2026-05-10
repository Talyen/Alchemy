import { starterDeck, type CharacterId } from "@/lib/game-data";
import type { TalentXP } from "@/lib/talents";
import type { BuildingId, FarmId, MaterialInventory, ResearchId } from "@/lib/homestead/types";
import { emptyInventory } from "@/lib/homestead/types";

import type { UnlockedTalents } from "./talent-pool";
import type { DisplayMode, ResolutionOption, UiScale } from "./types";
import { SAVE_KEY } from "@/lib/game-constants";

const storageKey = SAVE_KEY;

type SaveData = {
  selectedResolution: ResolutionOption;
  displayMode: DisplayMode;
  uiScale: UiScale;
  brightness: number;
  discoveredCardIds: string[];
  encounteredEnemyIds: string[];
  discoveredTrinketIds: string[];
  talentXP: TalentXP;
  unlockedTalents: UnlockedTalents;
  musicVolume: number;
  sfxVolume: number;
  masterVolume: number;
  muteInBackground: boolean;
  autoEndTurn: boolean;
  activeRun: ActiveRunData | null;
  materialInventory: MaterialInventory;
  constructedBuildings: BuildingId[];
  plantedFarms: FarmId[];
  completedResearch: ResearchId[];
  pendingFarmYield: boolean;
};

type ActiveRunData = {
  characterId: CharacterId;
};

export function normalizeActiveRun(activeRun: unknown): ActiveRunData | null {
  if (!activeRun || typeof activeRun !== "object") {
    return null;
  }

  const candidate = activeRun as { characterId?: string };
  const characterId = candidate.characterId === "sorcerer" ? "wizard" : candidate.characterId === "warden" ? "ranger" : candidate.characterId;
  if (characterId !== "knight" && characterId !== "ranger" && characterId !== "rogue" && characterId !== "wizard") {
    return null;
  }

  return { characterId };
}

export const defaultSaveData: SaveData = {
  selectedResolution: "1920x1080",
  displayMode: "borderless-fullscreen",
  uiScale: "100",
  discoveredCardIds: starterDeck.map((card) => card.id),
  encounteredEnemyIds: [],
  discoveredTrinketIds: [],
  talentXP: {},
  unlockedTalents: {},
  musicVolume: 35,
  sfxVolume: 70,
  masterVolume: 100,
  muteInBackground: true,
  autoEndTurn: true,
  brightness: 100,
  activeRun: null,
  materialInventory: emptyInventory(),
  constructedBuildings: [],
  plantedFarms: [],
  completedResearch: [],
  pendingFarmYield: false,
};

export function loadAlchemySaveData(): SaveData {
  if (typeof window === "undefined") {
    return defaultSaveData;
  }

  const raw = window.localStorage.getItem(storageKey);
  if (!raw) {
    return defaultSaveData;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    return {
      selectedResolution: parsed.selectedResolution ?? defaultSaveData.selectedResolution,
      displayMode: normalizeDisplayMode(parsed.displayMode),
      uiScale: normalizeUiScale(parsed.uiScale),
      discoveredCardIds: Array.isArray(parsed.discoveredCardIds) ? parsed.discoveredCardIds : defaultSaveData.discoveredCardIds,
      encounteredEnemyIds: Array.isArray(parsed.encounteredEnemyIds) ? parsed.encounteredEnemyIds : defaultSaveData.encounteredEnemyIds,
      discoveredTrinketIds: Array.isArray(parsed.discoveredTrinketIds) ? parsed.discoveredTrinketIds : defaultSaveData.discoveredTrinketIds,
      talentXP: typeof parsed.talentXP === 'object' && parsed.talentXP ? parsed.talentXP as TalentXP : defaultSaveData.talentXP,
      unlockedTalents: typeof parsed.unlockedTalents === 'object' && parsed.unlockedTalents ? parsed.unlockedTalents as UnlockedTalents : defaultSaveData.unlockedTalents,
      musicVolume: typeof parsed.musicVolume === 'number' ? parsed.musicVolume : defaultSaveData.musicVolume,
      sfxVolume: typeof parsed.sfxVolume === 'number' ? parsed.sfxVolume : defaultSaveData.sfxVolume,
      masterVolume: typeof parsed.masterVolume === 'number' ? parsed.masterVolume : defaultSaveData.masterVolume,
      muteInBackground: typeof parsed.muteInBackground === "boolean" ? parsed.muteInBackground : defaultSaveData.muteInBackground,
      autoEndTurn: typeof parsed.autoEndTurn === "boolean" ? parsed.autoEndTurn : defaultSaveData.autoEndTurn,
      brightness: typeof parsed.brightness === "number" ? parsed.brightness : defaultSaveData.brightness,
      activeRun: normalizeActiveRun(parsed.activeRun),
      materialInventory: typeof parsed.materialInventory === 'object' && parsed.materialInventory ? parsed.materialInventory as MaterialInventory : defaultSaveData.materialInventory,
      constructedBuildings: Array.isArray(parsed.constructedBuildings) ? parsed.constructedBuildings as BuildingId[] : defaultSaveData.constructedBuildings,
      plantedFarms: Array.isArray(parsed.plantedFarms) ? parsed.plantedFarms as FarmId[] : defaultSaveData.plantedFarms,
      completedResearch: Array.isArray(parsed.completedResearch) ? parsed.completedResearch as ResearchId[] : defaultSaveData.completedResearch,
      pendingFarmYield: typeof parsed.pendingFarmYield === "boolean" ? parsed.pendingFarmYield : defaultSaveData.pendingFarmYield,
    };
  } catch {
    return defaultSaveData;
  }
}

function normalizeDisplayMode(displayMode: unknown): DisplayMode {
  if (displayMode === "windowed" || displayMode === "borderless-fullscreen" || displayMode === "fullscreen") {
    return displayMode;
  }

  return defaultSaveData.displayMode;
}

function normalizeUiScale(uiScale: unknown): UiScale {
  if (uiScale === "90" || uiScale === "100" || uiScale === "110" || uiScale === "120") {
    return uiScale;
  }

  return defaultSaveData.uiScale;
}

export function saveAlchemySaveData(data: SaveData) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(data));
}

export function clearAlchemySaveData() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(storageKey);
}
