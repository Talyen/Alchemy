// Unified store reset orchestrator for cleaning active combat/run state and persistent data.
import { teardownRun } from "./run-transitions";
import { getRunDomainStore } from "./run-domain-store";
import { useHomesteadStore } from "./homestead-store";
import { useAppStore } from "./app-store";
import { useUiStore } from "./ui-store";

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
  useAppStore.getState().clearSavedAppState();
  getRunDomainStore().clearPermanentData();
  useHomesteadStore.getState().reset();
}
