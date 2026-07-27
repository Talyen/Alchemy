// Builds a SaveData snapshot from live app, run, and gear stores.
import { CURRENT_CONTENT_VERSION, CURRENT_GAME_BUILD_VERSION, CURRENT_SAVE_SCHEMA_VERSION } from "@/lib/validation";
import { useAppStore } from "@/features/alchemy/shared/stores/app-store";
import { readPermanentProgressForSave } from "@/features/alchemy/shared/stores/run-save-readers";
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

function readPermanentProgressSnapshot(): {
  progress: ProgressSnapshot;
  talentXP: TalentXP;
  unlockedTalents: UnlockedTalents;
} {
  const permanent = readPermanentProgressForSave();
  return {
    progress: {
      materialInventory: permanent.materialInventory,
      constructedBuildings: permanent.constructedBuildings,
      plantedFarms: permanent.plantedFarms,
      completedResearch: permanent.completedResearch,
      bondedCompanions: permanent.bondedCompanions,
      effects: permanent.effects,
    },
    talentXP: permanent.talentXP,
    unlockedTalents: permanent.unlockedTalents,
  };
}

export function buildAlchemySaveDataFromStores(
  activeRun: ActiveRunData | null,
  progress?: ProgressSnapshot,
  talentXP?: TalentXP,
  unlockedTalents?: UnlockedTalents,
): SaveData {
  const app = useAppStore.getState();
  let p: ProgressSnapshot;
  let resolvedTalentXP: TalentXP;
  let resolvedUnlockedTalents: UnlockedTalents;
  if (progress !== undefined) {
    p = progress;
    resolvedTalentXP = talentXP ?? {};
    resolvedUnlockedTalents = unlockedTalents ?? {};
  } else {
    const snapshot = readPermanentProgressSnapshot();
    p = snapshot.progress;
    resolvedTalentXP = talentXP ?? snapshot.talentXP;
    resolvedUnlockedTalents = unlockedTalents ?? snapshot.unlockedTalents;
  }
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
    talentXP: resolvedTalentXP,
    unlockedTalents: resolvedUnlockedTalents,
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
