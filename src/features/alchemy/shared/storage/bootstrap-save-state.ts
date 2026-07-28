// Boots persisted save state after optional Steam init so desktop cloud merge can run.
import { platform } from "@/lib/platform";
import { loadAlchemySaveState, type SaveLoadState } from "./io";
import type { SaveData } from "./types";
import { hydrateAlchemyPersistenceFields } from "./persistence-coordinator";

export async function bootstrapAlchemySaveState(): Promise<SaveLoadState> {
  if (platform.isDesktop) {
    await platform.steam.init();
  }
  return loadAlchemySaveState();
}

export function applySaveDataToStores(data: SaveData) {
  hydrateAlchemyPersistenceFields(data);
}
