// Unified store reset orchestrator for cleaning active combat/run state and persistent data.
import { teardownRun } from "./run-transitions";
import { getRunDomainStore } from "./run-domain-store";
import { useProfileStore } from "./profile-store";
import { useSettingsStore } from "./settings-store";
import { useUiStore } from "./ui-store";
import { useGearStore } from "./gear-store";
import { clearAlchemySaveData } from "@/features/alchemy/shared/storage";

/** Prefer {@link teardownRun} from run-transitions at call sites outside this module. */
export function resetActiveRunStores() {
  teardownRun();
}

/** Resets UI hover/shimmer and clears transient session fields (tests and between-run teardown). */
export function resetTransientRunUi() {
  useUiStore.setState(useUiStore.getInitialState(), true);
  getRunDomainStore().clearTransientSession();
}

export function clearAllPersistentGameData() {
  void clearAlchemySaveData();
  useSettingsStore.getState().resetToDefaults();
  useProfileStore.getState().resetToDefaults();
  getRunDomainStore().clearPermanentData();
  useGearStore.getState().reset();
}
