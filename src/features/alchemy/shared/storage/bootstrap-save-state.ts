import { initializeSteam, isDesktop } from "@/lib/platform";
import { createPlatformSaveBackend } from "@/lib/platform-save-backend";
import { configureSaveBackend, loadAlchemySaveState } from "./io";
import type { SaveLoadState } from "./save-candidates";

export async function bootstrapAlchemySaveState(): Promise<SaveLoadState> {
  const steam = isDesktop() ? await initializeSteam() : { playerName: null, cloudSyncEnabled: false };
  configureSaveBackend(createPlatformSaveBackend({ cloudSyncEnabled: steam.cloudSyncEnabled }));
  return loadAlchemySaveState();
}
