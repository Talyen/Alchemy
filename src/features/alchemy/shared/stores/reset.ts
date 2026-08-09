// Unified store reset orchestrator for cleaning active combat/run state and persistent data.
import { teardownRun } from "./run-transitions";
import { useSettingsStore } from "./settings-store";
import { useUiStore } from "./ui-store";
import { clearAlchemySaveData } from "@/features/alchemy/shared/storage";
import { dispatchRunSessionCommand } from "./run-session-command";
import {
  createGameplayDraftGearActions,
  createGameplayDraftProfileActions,
  createGameplayDraftRunProfileActions,
  createGameplayDraftSessionActions,
} from "./gameplay-state-store";

/** Prefer the lifecycle port's {@link teardownRun} at call sites outside shared/stores. */
export function resetActiveRunStores() {
  teardownRun();
}

/** Resets UI hover/shimmer and clears transient session fields (tests and between-run teardown). */
export function resetTransientRunUi() {
  useUiStore.setState(useUiStore.getInitialState(), true);
  dispatchRunSessionCommand((draft) => createGameplayDraftSessionActions(draft).clearTransientSession());
}

export function clearAllPersistentGameData() {
  void clearAlchemySaveData();
  useSettingsStore.getState().resetToDefaults();
  dispatchRunSessionCommand((draft) => {
    createGameplayDraftProfileActions(draft).resetToDefaults();
    createGameplayDraftRunProfileActions(draft).clearPermanentData();
    createGameplayDraftGearActions(draft).gearReset();
  });
}
