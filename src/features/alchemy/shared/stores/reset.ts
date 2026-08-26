// Unified store reset orchestrator for cleaning active combat/run state and persistent data.
import { useSettingsStore } from "./settings-store";
import { useUiStore } from "./ui-store";
import { clearAlchemySaveData } from "@/features/alchemy/shared/storage";
import { dispatchRunSessionCommand } from "./run-session-command";
import { clearTransientSession } from "./write-port-session";
import { clearPermanentData, resetToDefaults } from "./write-port-profile";
import { resetGear } from "./gear-actions";
import { logError } from "@/lib/error-logger";

let persistentClearInFlight = false;

/** Test/teardown support: resets UI hover/shimmer and clears transient session fields. */
export function resetTransientRunUi() {
  useUiStore.setState(useUiStore.getInitialState(), true);
  dispatchRunSessionCommand((draft) => clearTransientSession(draft));
}

/**
 * Wipe persisted save data, then reset in-memory settings/profile/gear.
 * Fails closed: if the disk wipe does not confirm, memory is left unchanged.
 */
export async function clearAllPersistentGameData(): Promise<boolean> {
  if (persistentClearInFlight) return false;
  persistentClearInFlight = true;
  try {
    const cleared = await clearAlchemySaveData();
    if (!cleared) {
      logError("Save data could not be cleared; memory was left unchanged", "storage");
      return false;
    }
    useSettingsStore.getState().resetToDefaults();
    dispatchRunSessionCommand((draft) => {
      resetToDefaults(draft);
      clearPermanentData(draft);
      resetGear(draft.gear);
    });
    return true;
  } finally {
    persistentClearInFlight = false;
  }
}
