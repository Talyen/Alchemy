// Boots persisted save state after optional Steam init so desktop cloud merge can run.
import { platform } from "@/lib/platform";
import { loadAlchemySaveState, type SaveLoadState } from "./io";
import type { SaveData } from "./types";
import { useProfileStore } from "@/features/alchemy/shared/stores/profile-store";
import { useSettingsStore } from "@/features/alchemy/shared/stores/settings-store";
import { applyHomesteadSaveFields } from "@/features/alchemy/shared/stores/run-session-facade";
import { useGearStore } from "@/features/alchemy/shared/stores/gear-store";

export async function bootstrapAlchemySaveState(): Promise<SaveLoadState> {
  if (platform.isDesktop) {
    await platform.steam.init();
  }
  return loadAlchemySaveState();
}

export function applySaveDataToStores(data: SaveData) {
  useSettingsStore.getState().initialize(data);
  useProfileStore.getState().initialize(data);
  applyHomesteadSaveFields({
    materialInventory: data.materialInventory,
    constructedBuildings: data.constructedBuildings,
    plantedFarms: data.plantedFarms,
    completedResearch: data.completedResearch,
    bondedCompanions: data.bondedCompanions,
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
