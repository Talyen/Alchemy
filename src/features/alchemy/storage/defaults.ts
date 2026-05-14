import { allStartingDeckCardIds } from "@/lib/game-data";
import { emptyInventory } from "@/lib/homestead/types";
import type { SaveData } from "./types";

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
  completedDifficulties: { knight: [], rogue: [], wizard: [], ranger: [] },
};
