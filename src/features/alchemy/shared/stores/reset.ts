import { useSettingsStore } from "./settings-store";
import { useUiStore } from "./ui-store";
import { clearAlchemySaveData } from "@/features/alchemy/shared/storage";
import { dispatchRunSessionCommand } from "./run-session-command";
import { clearActiveRunInDraft } from "./run-lifecycle";
import { resetGear } from "./gear-actions";
import {
  clearPermanentData,
  clearTransientSession,
  resetToDefaults as resetRunSessionToDefaults,
} from "./run-session-write-port";
import { logStorageFailure } from "@/lib/storage-logging";

let persistentClearInFlight = false;

// Test/boot helper only: resets the UI store and clears the transient session
// without touching battle state. Not mid-battle safe (a live battle and its
// pending transition survive under fresh UI) — use the lifecycle teardown
// paths for in-run resets.
export function resetTransientRunUi() {
  useUiStore.setState(useUiStore.getInitialState(), true);
  dispatchRunSessionCommand((draft) => clearTransientSession(draft));
}

export async function clearAllPersistentGameData(): Promise<boolean> {
  if (persistentClearInFlight) return false;
  persistentClearInFlight = true;
  try {
    const cleared = await clearAlchemySaveData("localWipe");
    if (!cleared) {
      logStorageFailure("Save data could not be cleared; memory was left unchanged");
      return false;
    }
    useSettingsStore.getState().resetToDefaults();
    // Device display sizes intentionally survive: they live outside the
    // versioned save (see MIGRATIONS.md public save contract) and Reset
    // Options — not this wipe — is their reset path.
    useUiStore.getState().setShowClearSaveConfirm(false);
    dispatchRunSessionCommand((draft) => {
      resetRunSessionToDefaults(draft);
      clearPermanentData(draft);
      resetGear(draft.gear);
      clearActiveRunInDraft(draft);
    });
    return true;
  } finally {
    persistentClearInFlight = false;
  }
}
