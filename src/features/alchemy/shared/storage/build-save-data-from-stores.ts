// Builds a SaveData snapshot from live app, run, and homestead stores.
import { CURRENT_CONTENT_VERSION, CURRENT_GAME_BUILD_VERSION, CURRENT_SAVE_SCHEMA_VERSION } from "@/lib/validation";
import { useAppStore } from "@/features/alchemy/shared/stores/app-store";
import { useHomesteadStore } from "@/features/alchemy/shared/stores/homestead-store";
import { readActiveRunStore } from "@/features/alchemy/shared/stores/run-session-facade";
import type { ActiveRunData } from "@/lib/active-run-session";
import type { SaveData } from "./types";

export function buildAlchemySaveDataFromStores(activeRun: ActiveRunData | null): SaveData {
  const app = useAppStore.getState();
  const run = readActiveRunStore();
  const homestead = useHomesteadStore.getState();

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
    talentXP: run.talentXP,
    unlockedTalents: run.unlockedTalents,
    musicVolume: app.musicVol,
    sfxVolume: app.sfxVol,
    masterVolume: app.masterVol,
    muteInBackground: app.muteInBackground,
    autoEndTurn: app.autoEndTurn,
    activeRun,
    materialInventory: homestead.materialInventory,
    constructedBuildings: homestead.constructedBuildings,
    plantedFarms: homestead.plantedFarms,
    completedResearch: homestead.completedResearch,
    bondedCompanions: homestead.bondedCompanions,
    completedDifficulties: app.completedDifficulties,
    finishedRunCharacters: app.finishedRunCharacters,
  };
}
