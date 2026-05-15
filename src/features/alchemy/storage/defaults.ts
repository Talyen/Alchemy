// Default save data for first boot and per-field fallback when loading older saves.
// Every SaveData field has a safe default here so null-coalescing elsewhere is optional.
import { allStartingDeckCardIds, companionLibrary } from "@/lib/game-data";
import { emptyInventory } from "@/lib/homestead/inventory";
import { buildings, farmPlots, researchUpgrades } from "@/lib/homestead/data";
import { createEmptyTierRecord } from "@/lib/homestead/tiers";
import type { SaveData } from "./types";

const companionItems = Object.keys(companionLibrary).map((id) => ({ id, tiers: [null, null, null] }));

export const defaultSaveData: SaveData = {
  selectedResolution: "1920x1080",
  displayMode: "borderless-fullscreen",
  uiScale: "100",
  discoveredCardIds: [...allStartingDeckCardIds],
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
  constructedBuildings: createEmptyTierRecord(buildings),
  plantedFarms: createEmptyTierRecord(farmPlots),
  completedResearch: createEmptyTierRecord(researchUpgrades),
  bondedCompanions: createEmptyTierRecord(companionItems) as Record<import("@/lib/game-data").CompanionId, number>,
  completedDifficulties: { knight: [], rogue: [], wizard: [], ranger: [] },
};
