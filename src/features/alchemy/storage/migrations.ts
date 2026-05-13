// Save normalization and migration helpers for legacy or partial localStorage payloads.
// Depends on current game data, battle health defaults, homestead IDs, and save defaults.
import { getStartingDeck, type BattleCard, type CharacterId } from "@/lib/game-data";
import type { TalentXP } from "@/lib/talents";
import type { BuildingId, FarmId, MaterialInventory, ResearchId } from "@/lib/homestead/types";

import type { UnlockedTalents } from "../talent-pool";
import type { DisplayMode, UiScale } from "../types";
import type { ActiveRunData } from "../use-run-state";
import { defaultSaveData, type SaveData } from "./types";

type PersistedRunCandidate = Record<string, unknown> & {
  runDeck: unknown[];
  runGold: number;
  runPlayerHealth: number;
  runMaxHealth: number;
  roomsEncountered: number;
  currentAct: number;
  destinationIndexInAct: number;
  completedDestinations: unknown[];
  runTrinkets: unknown[];
};

const legacyStarterDeckIds = ["slash", "bash", "block", "anvil", "plate-mail", "apple", "meteor", "blessed-aegis"];

// Character IDs are persisted, so renamed or invalid IDs need explicit guarding before hydration.
function isValidCharacterId(id: string): id is CharacterId {
  return id === "knight" || id === "ranger" || id === "rogue" || id === "wizard";
}

// Active-run snapshots must include real run fields; a lone characterId is only a
// default/legacy fragment and should not make the main menu offer Resume Run.
function hasPersistedRunShape(candidate: Record<string, unknown>): candidate is PersistedRunCandidate {
  return Array.isArray(candidate.runDeck)
    && typeof candidate.runGold === "number"
    && typeof candidate.runPlayerHealth === "number"
    && typeof candidate.runMaxHealth === "number"
    && typeof candidate.roomsEncountered === "number"
    && typeof candidate.currentAct === "number"
    && typeof candidate.destinationIndexInAct === "number"
    && Array.isArray(candidate.completedDestinations)
    && Array.isArray(candidate.runTrinkets);
}

// Deck comparison uses IDs because saves store card objects whose other fields may be stale.
function deckIdsMatch(deck: unknown[], ids: string[]): boolean {
  return deck.length === ids.length
    && deck.every((card, index) => typeof card === "object" && card !== null && (card as BattleCard).id === ids[index]);
}

// Only unstarted active-run snapshots are safe to repair without deleting legitimate run progress.
function isUnstartedRun(candidate: PersistedRunCandidate): boolean {
  return candidate.roomsEncountered === 0
    && candidate.currentAct === 1
    && candidate.destinationIndexInAct === 0
    && candidate.completedDestinations.length === 0;
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

  if (!hasPersistedRunShape(candidate)) {
    return null;
  }

  const shouldUseClassDeck = candidate.runDeck.length === 0
    || (isUnstartedRun(candidate) && deckIdsMatch(candidate.runDeck, legacyStarterDeckIds));
  const runDeck = shouldUseClassDeck ? getStartingDeck(characterId) : candidate.runDeck as BattleCard[];
  const runGold = candidate.runGold;
  const runPlayerHealth = candidate.runPlayerHealth;
  const runMaxHealth = candidate.runMaxHealth;
  const roomsEncountered = candidate.roomsEncountered;
  const currentAct = candidate.currentAct;
  const destinationIndexInAct = candidate.destinationIndexInAct;
  const completedDestinations = candidate.completedDestinations as string[];
  const runTrinkets = candidate.runTrinkets as string[];

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
