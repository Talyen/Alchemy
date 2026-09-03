import { useSettingsStore } from "./settings-store";
import { useUiStore } from "./ui-store";
import { clearAlchemySaveData } from "@/features/alchemy/shared/storage";
import { dispatchRunSessionCommand } from "./run-session-command";
import { clearTransientSession } from "./write-port-session";
import { initializeActiveBattle, resetNavigation, resetProgress } from "./write-port-run";
import { clearPermanentData, resetToDefaults } from "./write-port-meta";
import { resetGear } from "./gear-actions";
import { logError } from "@/lib/error-logger";

let persistentClearInFlight = false;

export function resetTransientRunUi() {
  useUiStore.setState(useUiStore.getInitialState(), true);
  dispatchRunSessionCommand((draft) => clearTransientSession(draft));
}

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
      resetProgress(draft);
      resetNavigation(draft);
      clearTransientSession(draft);
      initializeActiveBattle(draft, null);
    });
    return true;
  } finally {
    persistentClearInFlight = false;
  }
}
