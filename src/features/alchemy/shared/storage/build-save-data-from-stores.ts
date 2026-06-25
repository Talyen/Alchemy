// Builds a SaveData snapshot from live app, run, and gear stores.
import { CURRENT_CONTENT_VERSION, CURRENT_GAME_BUILD_VERSION, CURRENT_SAVE_SCHEMA_VERSION } from "@/lib/validation";
import { useAppStore } from "@/features/alchemy/shared/stores/app-store";
import type { ActiveRunData } from "@/lib/active-run-session";
import type { MaterialInventory, BuildingId, FarmId, ResearchId, HomesteadEffectManifest } from "@/lib/homestead/types";
import type { SaveData } from "./types";
import { useGearStore } from "@/features/alchemy/shared/stores/gear-store";
import type { CompanionId, TalentXP, UnlockedTalents } from "@/lib/game-data";

interface ProgressSnapshot {
  materialInventory: MaterialInventory;
  constructedBuildings: Record<BuildingId, number>;
  plantedFarms: Record<FarmId, number>;
  completedResearch: Record<ResearchId, number>;
  bondedCompanions: Record<CompanionId, number>;
  effects: HomesteadEffectManifest;
}

export function buildAlchemySaveDataFromStores(
  activeRun: ActiveRunData | null,
  progress?: ProgressSnapshot,
  talentXP?: TalentXP,
  unlockedTalents?: UnlockedTalents,
): SaveData {
  const app = useAppStore.getState();
  const p = progress ?? {
    materialInventory: {} as MaterialInventory,
    constructedBuildings: {} as Record<BuildingId, number>,
    plantedFarms: {} as Record<FarmId, number>,
    completedResearch: {} as Record<ResearchId, number>,
    bondedCompanions: {} as Record<CompanionId, number>,
    effects: {} as HomesteadEffectManifest,
  };
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
    talentXP: talentXP ?? {},
    unlockedTalents: unlockedTalents ?? {},
    musicVolume: app.musicVol,
    sfxVolume: app.sfxVol,
    masterVolume: app.masterVol,
    muteInBackground: app.muteInBackground,
    autoEndTurn: app.autoEndTurn,
    activeRun,
    materialInventory: p.materialInventory,
    constructedBuildings: p.constructedBuildings,
    plantedFarms: p.plantedFarms,
    completedResearch: p.completedResearch,
    bondedCompanions: p.bondedCompanions,
    completedDifficulties: app.completedDifficulties,
    finishedRunCharacters: app.finishedRunCharacters,
    lastSavedAt: Date.now(),
  };
}
