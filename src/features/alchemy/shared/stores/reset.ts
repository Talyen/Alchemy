// Unified store reset orchestrator for cleaning active combat/run state and persistent data.
import { useSettingsStore } from "./settings-store";
import { useUiStore } from "./ui-store";
import { clearAlchemySaveData } from "@/features/alchemy/shared/storage";
import { dispatchRunSessionCommand } from "./run-session-command";
import { clearTransientSession } from "./write-port-session";
import { clearPermanentData, resetToDefaults } from "./write-port-profile";
import { resetGear } from "./gear-actions";

/** Test/teardown support: resets UI hover/shimmer and clears transient session fields. */
export function resetTransientRunUi() {
  useUiStore.setState(useUiStore.getInitialState(), true);
  dispatchRunSessionCommand((draft) => clearTransientSession(draft));
}

export function clearAllPersistentGameData() {
  void clearAlchemySaveData();
  useSettingsStore.getState().resetToDefaults();
  dispatchRunSessionCommand((draft) => {
    resetToDefaults(draft);
    clearPermanentData(draft);
    resetGear(draft.gear);
  });
}
