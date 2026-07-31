// Unified store reset orchestrator for cleaning active combat/run state and persistent data.
import { teardownRun } from "./run-transitions";
import { getRunProfileStore } from "./run-profile-store";
import { getRunTransientStore } from "./run-transient-store";
import { useProfileStore } from "./profile-store";
import { useSettingsStore } from "./settings-store";
import { useUiStore } from "./ui-store";
import { useGearStore } from "./gear-store";
import { clearAlchemySaveData } from "@/features/alchemy/shared/storage";
import { dispatchRunSessionCommand } from "./run-session-command";

/** Prefer {@link teardownRun} from run-session-facade at call sites outside shared/stores. */
export function resetActiveRunStores() {
  teardownRun();
}

/** Resets UI hover/shimmer and clears transient session fields (tests and between-run teardown). */
export function resetTransientRunUi() {
  useUiStore.setState(useUiStore.getInitialState(), true);
  getRunTransientStore().clearTransientSession();
}

export function clearAllPersistentGameData() {
  void clearAlchemySaveData();
  useSettingsStore.getState().resetToDefaults();
  dispatchRunSessionCommand(() => {
    useProfileStore.getState().resetToDefaults();
    getRunProfileStore().clearPermanentData();
    useGearStore.getState().reset();
  });
}
