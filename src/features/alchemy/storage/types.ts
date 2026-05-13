// Save-data types and defaults for settings, collection, run, talents, and homestead state.
// Depends on character game data plus talent, homestead, run, and option type contracts.
import { allStartingDeckCardIds } from "@/lib/game-data";
import type { TalentXP } from "@/lib/talents";
import {
  emptyInventory,
  type BuildingId,
  type FarmId,
  type MaterialInventory,
  type ResearchId,
} from "@/lib/homestead/types";

import type { UnlockedTalents } from "../talent-pool";
import type { ActiveRunData } from "../run/types";
import type { DisplayMode, ResolutionOption, UiScale } from "../types";

export type SaveData = {
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
};

// Default save state is used both for first boot and as a per-field fallback when old
// localStorage payloads are missing newer settings/progression fields.
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
  constructedBuildings: [],
  plantedFarms: [],
  completedResearch: [],
};
