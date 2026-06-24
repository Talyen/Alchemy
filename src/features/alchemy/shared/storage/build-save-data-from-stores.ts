// Builds a SaveData snapshot from live app, run, and gear stores.
import { CURRENT_CONTENT_VERSION, CURRENT_GAME_BUILD_VERSION, CURRENT_SAVE_SCHEMA_VERSION } from "@/lib/validation";
import { useAppStore } from "@/features/alchemy/shared/stores/app-store";
import { readActiveRunStore, getRunDomainStore } from "@/features/alchemy/shared/stores/run-session-facade";
import type { ActiveRunData } from "@/lib/active-run-session";
import type { SaveData } from "./types";
import { useGearStore } from "@/features/alchemy/shared/stores/gear-store";

export function buildAlchemySaveDataFromStores(activeRun: ActiveRunData | null): SaveData {
  const app = useAppStore.getState();
  const run = readActiveRunStore();
  const progress = getRunDomainStore().progress;
  const gear = useGearStore.getState();

  return {
    saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
    gameBuildVersion: CURRENT_GAME_BUILD_VERSION,
    contentVersion: CURRENT_CONTENT_VERSION,
    selectedAspectRatio: app.selectedAspectRatio,
    displayMode: app.displayMode,
    uiScale: app.uiScale,
    brightness: app.brightness,
    discoveredCardIds: app.discoveredCardIds,
    encounteredEnemyIds: app.encounteredEnemyIds,
    discoveredTrinketIds: app.discoveredTrinketIds,
    gearInventories: gear.inventories,
    gearLoadouts: gear.loadouts,
    gearBoardPositionsByCharacter: gear.boardPositionsByCharacter,
    craftingCurrencyBoardPositionsByCharacter: gear.currencyBoardPositionsByCharacter,
    craftingCurrencies: gear.craftingCurrencies,
    talentXP: run.talentXP,
    unlockedTalents: run.unlockedTalents,
    musicVolume: app.musicVol,
    sfxVolume: app.sfxVol,
    masterVolume: app.masterVol,
    muteInBackground: app.muteInBackground,
    autoEndTurn: app.autoEndTurn,
    activeRun,
    materialInventory: progress.materialInventory,
    constructedBuildings: progress.constructedBuildings,
    plantedFarms: progress.plantedFarms,
    completedResearch: progress.completedResearch,
    bondedCompanions: progress.bondedCompanions,
    completedDifficulties: app.completedDifficulties,
    finishedRunCharacters: app.finishedRunCharacters,
    lastSavedAt: Date.now(),
  };
}
