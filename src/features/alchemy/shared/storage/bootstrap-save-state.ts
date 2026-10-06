import type { GameSession } from "../stores/game-session-types";
import { initializeSteam, isDesktop } from "@/lib/platform";
import { createPlatformSaveBackend } from "@/lib/platform-save-backend";
import { configureSaveBackend, loadAlchemySaveState } from "./io";
import type { SaveLoadState } from "./save-candidates";

export async function configureAlchemySaveBackend(gameSession: GameSession): Promise<void> {
  const steam = isDesktop() ? await initializeSteam() : { playerName: null, cloudSyncEnabled: false };
  configureSaveBackend(createPlatformSaveBackend({ cloudSyncEnabled: steam.cloudSyncEnabled }), gameSession);
}

export async function bootstrapAlchemySaveState(gameSession: GameSession): Promise<SaveLoadState> {
  await configureAlchemySaveBackend(gameSession);
  return loadAlchemySaveState(gameSession);
}
