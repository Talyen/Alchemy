// Unified store reset orchestrator for cleaning active combat/run state and persistent data.
import { teardownRun } from "./run-transitions";
import { getRunDomainStore } from "./run-domain-store";
import { useHomesteadStore } from "./homestead-store";
import { useAppStore } from "./app-store";

/** Prefer {@link teardownRun} from run-transitions at call sites outside this module. */
export function resetActiveRunStores() {
  teardownRun();
}

export function clearAllPersistentGameData() {
  useAppStore.getState().clearSavedAppState();
  getRunDomainStore().clearPermanentData();
  useHomesteadStore.getState().reset();
}
