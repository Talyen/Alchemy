// Boots persisted save state after optional Steam init so desktop cloud merge can run.
import { platform } from "@/lib/platform";
import { loadAlchemySaveState, type SaveLoadState } from "./io";

export async function bootstrapAlchemySaveState(): Promise<SaveLoadState> {
  if (platform.isDesktop) {
    await platform.steam.init();
  }
  return loadAlchemySaveState();
}
