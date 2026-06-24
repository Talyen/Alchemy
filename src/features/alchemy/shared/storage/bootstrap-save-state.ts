// Boots persisted save state after optional Steam init so desktop cloud merge can run.
import { platform } from "@/lib/platform";
import { loadAlchemySaveState, type SaveLoadState } from "./io";
import type { SaveData } from "./types";
import { useAppStore } from "@/features/alchemy/shared/stores/app-store";
import { useRunDomainStore } from "@/features/alchemy/shared/stores/run-session-facade";
import { useGearStore } from "@/features/alchemy/shared/stores/gear-store";
import { computeHomesteadEffects } from "@/lib/homestead/effects";

export async function bootstrapAlchemySaveState(): Promise<SaveLoadState> {
  if (platform.isDesktop) {
    await platform.steam.init();
  }
  return loadAlchemySaveState();
}

export function applySaveDataToStores(data: SaveData) {
  useAppStore.getState().initialize(data);
  useRunDomainStore.setState((state) => {
    const homestead = {
      materialInventory: data.materialInventory,
      constructedBuildings: data.constructedBuildings,
      plantedFarms: data.plantedFarms,
      completedResearch: data.completedResearch,
      bondedCompanions: data.bondedCompanions,
    };
    state.progress.materialInventory = homestead.materialInventory;
    state.progress.constructedBuildings = homestead.constructedBuildings;
    state.progress.plantedFarms = homestead.plantedFarms;
    state.progress.completedResearch = homestead.completedResearch;
    state.progress.bondedCompanions = homestead.bondedCompanions;
    state.progress.effects = computeHomesteadEffects(
      homestead.constructedBuildings,
      homestead.plantedFarms,
      homestead.completedResearch,
      homestead.bondedCompanions,
    );
  });
  useGearStore
    .getState()
    .initialize(
      data.gearInventories,
      data.gearLoadouts,
      data.gearBoardPositionsByCharacter,
      data.craftingCurrencies,
      data.craftingCurrencyBoardPositionsByCharacter,
    );
}
