// Default save data for first boot and per-field fallback when loading older saves.
// Every SaveData field has a safe default here so null-coalescing elsewhere is optional.
// Volume/brightness defaults are imported from game-constants.ts — save-schemas.ts uses the same
// constants for its .catch() fallbacks, guaranteeing both sources agree.
import type { CompanionId } from "@/lib/game-data";
import { emptyInventory } from "@/lib/homestead/inventory";
import { buildings, farmPlots, researchUpgrades } from "@/lib/homestead/data";
import { createEmptyTierRecord } from "@/lib/homestead/tiers";
import { companionTierItems } from "@/lib/homestead/companions";
import {
  DEFAULT_BRIGHTNESS_PCT,
  DEFAULT_MASTER_VOLUME_PCT,
  DEFAULT_MUSIC_VOLUME_PCT,
  DEFAULT_SFX_VOLUME_PCT,
} from "@/lib/game-constants";
import type { SaveData } from "./types";
import { CURRENT_CONTENT_VERSION, CURRENT_GAME_BUILD_VERSION, CURRENT_SAVE_SCHEMA_VERSION } from "@/lib/validation";
import {
  createEmptyGearLoadouts,
  createEmptyGearInventories,
  createEmptyGearBoardPositionsByCharacter,
  createEmptyCurrencyBoardPositionsByCharacter,
  EMPTY_CRAFTING_CURRENCIES,
} from "@/lib/gear";

const defaultCraftingCurrencies = { ...EMPTY_CRAFTING_CURRENCIES };

export const defaultSaveData: SaveData = {
  saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
  gameBuildVersion: CURRENT_GAME_BUILD_VERSION,
  contentVersion: CURRENT_CONTENT_VERSION,
  selectedAspectRatio: "auto",
  displayMode: "borderless-fullscreen",
  uiScale: "100",
  discoveredCardIds: [],
  encounteredEnemyIds: [],
  discoveredTrinketIds: [],
  gearInventories: createEmptyGearInventories(),
  gearLoadouts: createEmptyGearLoadouts(),
  gearBoardPositionsByCharacter: createEmptyGearBoardPositionsByCharacter(),
  craftingCurrencyBoardPositionsByCharacter: createEmptyCurrencyBoardPositionsByCharacter(),
  craftingCurrencies: { ...defaultCraftingCurrencies },
  talentXP: {},
  unlockedTalents: {},
  musicVolume: DEFAULT_MUSIC_VOLUME_PCT,
  sfxVolume: DEFAULT_SFX_VOLUME_PCT,
  masterVolume: DEFAULT_MASTER_VOLUME_PCT,
  muteInBackground: true,
  autoEndTurn: true,
  brightness: DEFAULT_BRIGHTNESS_PCT,
  activeRun: null,
  materialInventory: emptyInventory(),
  constructedBuildings: createEmptyTierRecord(buildings),
  plantedFarms: createEmptyTierRecord(farmPlots),
  completedResearch: createEmptyTierRecord(researchUpgrades),
  bondedCompanions: createEmptyTierRecord(companionTierItems) as Record<CompanionId, number>,
  completedDifficulties: {
    knight: [],
    rogue: [],
    wizard: [],
    ranger: [],
    alchemist: [],
    warlock: [],
    druid: [],
    wildcard: [],
  },
  finishedRunCharacters: [],
  lastSavedAt: 0,
};
