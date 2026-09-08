import { useSettingsStore } from "./settings-store";
import { useUiStore } from "./ui-store";
import { clearAlchemySaveData } from "@/features/alchemy/shared/storage";
import { dispatchRunSessionCommand } from "./run-session-command";
import { clearTransientSession } from "./write-port-session";
import { clearPermanentData, resetToDefaults } from "./write-port-meta";
import { resetGear } from "./gear-actions";
import { clearActiveRunInDraft } from "./run-lifecycle";
import { logStorageFailure } from "@/lib/storage-logging";

let persistentClearInFlight = false;

export function resetTransientRunUi() {
  useUiStore.setState(useUiStore.getInitialState(), true);
  dispatchRunSessionCommand((draft) => clearTransientSession(draft));
}

export async function clearAllPersistentGameData(): Promise<boolean> {
  if (persistentClearInFlight) return false;
  persistentClearInFlight = true;
  try {
    const cleared = await clearAlchemySaveData({ forceLocalWipe: true });
    if (!cleared) {
      logStorageFailure("Save data could not be cleared; memory was left unchanged");
      return false;
    }
    useSettingsStore.getState().resetToDefaults();
    dispatchRunSessionCommand((draft) => {
      resetToDefaults(draft);
      clearPermanentData(draft);
      resetGear(draft.gear);
      clearActiveRunInDraft(draft);
    });
    return true;
  } finally {
    persistentClearInFlight = false;
  }
}
