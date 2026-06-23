// Shared homestead save payloads for validation and E2E injection.
import {
  CURRENT_CONTENT_VERSION,
  CURRENT_GAME_BUILD_VERSION,
  CURRENT_SAVE_SCHEMA_VERSION,
} from "@/lib/validation/metadata";

export interface HomesteadSaveFixture {
  saveSchemaVersion: number;
  gameBuildVersion: string;
  contentVersion: number;
  selectedAspectRatio: string;
  displayMode: string;
  uiScale: string;
  brightness: number;
  musicVolume: number;
  sfxVolume: number;
  masterVolume: number;
  muteInBackground: boolean;
  autoEndTurn: boolean;
  completedDifficulties: Record<string, string[]>;
  activeRun: null;
  materialInventory: Record<string, number>;
  constructedBuildings: Record<string, number>;
  plantedFarms: Record<string, number>;
  completedResearch: Record<string, number>;
  bondedCompanions: Record<string, number>;
  discoveredCardIds: string[];
  encounteredEnemyIds: string[];
  discoveredTrinketIds: string[];
  talentXP: Record<string, number>;
  unlockedTalents: Record<string, unknown>;
  finishedRunCharacters: string[];
  lastSavedAt: number;
}

export const baseHomesteadSave: HomesteadSaveFixture = {
  saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
  gameBuildVersion: CURRENT_GAME_BUILD_VERSION,
  contentVersion: CURRENT_CONTENT_VERSION,
  selectedAspectRatio: "auto",
  displayMode: "borderless-fullscreen",
  uiScale: "100",
  brightness: 100,
  musicVolume: 50,
  sfxVolume: 50,
  masterVolume: 50,
  muteInBackground: true,
  autoEndTurn: true,
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
  finishedRunCharacters: ["knight", "rogue", "wizard", "ranger", "alchemist", "warlock", "druid"],
  activeRun: null,
  materialInventory: { wood: 999, iron: 999, herbs: 999, food: 999, crystal: 999 },
  constructedBuildings: {
    "blacksmiths-forge": 0,
    "hunters-lodge": 0,
    "alchemy-lab": 0,
    "runesmiths-workshop": 0,
    "companion-sanctuary": 0,
    "wishing-well": 0,
  },
  plantedFarms: {
    "wheat-field": 0,
    "herb-garden": 0,
    "chicken-coop": 0,
    pasture: 0,
    orchard: 0,
    "crystal-garden": 0,
  },
  completedResearch: {
    "leyline-energy": 0,
    "detect-magic": 0,
    "botanical-distillation": 0,
    "culinary-arts": 0,
    "wool-tailoring": 0,
    "agility-training": 0,
  },
  bondedCompanions: {
    wolf: 0,
    "lizard-scout": 0,
    imp: 0,
    "frost-whelp": 0,
    bear: 0,
    panther: 0,
    phoenix: 0,
  },
  discoveredCardIds: ["slash"],
  encounteredEnemyIds: [],
  discoveredTrinketIds: [],
  talentXP: {},
  unlockedTalents: {},
  lastSavedAt: 0,
};
