// Default save data for first boot and per-field fallback when loading older saves.
// Every SaveData field has a safe default here so null-coalescing elsewhere is optional.
import { allStartingDeckCardIds, type CompanionId } from "@/lib/game-data";
import { emptyInventory } from "@/lib/homestead/inventory";
import { buildings, farmPlots, researchUpgrades } from "@/lib/homestead/data";
import { createEmptyTierRecord } from "@/lib/homestead/tiers";
import { companionTierItems } from "@/lib/homestead/companions";
import type { SaveData } from "./types";
import { CURRENT_CONTENT_VERSION, CURRENT_GAME_BUILD_VERSION, CURRENT_SAVE_SCHEMA_VERSION } from "./metadata";

export const defaultSaveData: SaveData = {
  saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
  gameBuildVersion: CURRENT_GAME_BUILD_VERSION,
  contentVersion: CURRENT_CONTENT_VERSION,
  selectedAspectRatio: "auto",
  displayMode: "borderless-fullscreen",
  uiScale: "100",
  discoveredCardIds: [...allStartingDeckCardIds],
  encounteredEnemyIds: [],
  discoveredTrinketIds: [],
  talentXP: {},
  unlockedTalents: {},
  musicVolume: 50,
  sfxVolume: 50,
  masterVolume: 50,
  muteInBackground: true,
  autoEndTurn: true,
  brightness: 100,
  activeRun: null,
  materialInventory: emptyInventory(),
  constructedBuildings: createEmptyTierRecord(buildings),
  plantedFarms: createEmptyTierRecord(farmPlots),
  completedResearch: createEmptyTierRecord(researchUpgrades),
  bondedCompanions: createEmptyTierRecord(companionTierItems) as Record<CompanionId, number>,
  completedDifficulties: { knight: [], rogue: [], wizard: [], ranger: [] },
};
