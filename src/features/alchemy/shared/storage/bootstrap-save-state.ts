import { initializeSteam, isDesktop } from "@/lib/platform";
import { createPlatformSaveBackend } from "@/lib/platform-save-backend";
import { configureSaveBackend, loadAlchemySaveState, type SaveLoadState } from "./io";
import type { SaveData } from "./types";
import { hydrateAlchemyPersistenceFields } from "./persistence";

export async function bootstrapAlchemySaveState(): Promise<SaveLoadState> {
  const steam = isDesktop() ? await initializeSteam() : { playerName: null, cloudSyncEnabled: false };
  configureSaveBackend(createPlatformSaveBackend({ cloudSyncEnabled: steam.cloudSyncEnabled }));
  return loadAlchemySaveState();
}

export function applySaveDataToStores(data: SaveData) {
  hydrateAlchemyPersistenceFields(data);
}
