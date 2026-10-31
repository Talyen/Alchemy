import type { GameSession } from "../stores/session/game-session-types";
import { initializeSteamCloudSync, isDesktop } from "@/lib/platform";
import { createPlatformSaveBackend } from "@/lib/platform-save-backend";
import { configureSaveBackend, loadAlchemySaveState } from "./io";
import type { SaveLoadState } from "./save-candidates";

export async function configureAlchemySaveBackend(gameSession: GameSession): Promise<void> {
  const cloudSyncEnabled = isDesktop() && (await initializeSteamCloudSync());
  configureSaveBackend(createPlatformSaveBackend({ cloudSyncEnabled }), gameSession);
}

export async function bootstrapAlchemySaveState(gameSession: GameSession): Promise<SaveLoadState> {
  await configureAlchemySaveBackend(gameSession);
  return loadAlchemySaveState(gameSession);
}
