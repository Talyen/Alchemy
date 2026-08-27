import { setHasActiveBattle } from "./run-session-write-port";
import { dispatchRunSessionCommand } from "./run-session-command";
import { useUiStore } from "./ui-store";

type LifecycleListener = () => void;
const teardownListeners = new Set<LifecycleListener>();
const clearPresentationListeners = new Set<LifecycleListener>();

export function onRunTeardown(listener: LifecycleListener): () => void {
  teardownListeners.add(listener);
  return () => {
    teardownListeners.delete(listener);
  };
}

export function onClearBattlePresentation(listener: LifecycleListener): () => void {
  clearPresentationListeners.add(listener);
  return () => {
    clearPresentationListeners.delete(listener);
  };
}

/** Clear the battle-active flag and battle-related presentation state. */
export function clearBattleUi(): void {
  dispatchRunSessionCommand((draft) => setHasActiveBattle(draft, false));
  clearBattlePresentationUi();
}

/** Clear battle presentation after the gameplay commit that ended combat. */
export function clearBattlePresentationUi(): void {
  useUiStore.getState().clearCardHover();
  clearPresentationListeners.forEach((listener) => listener());
}

// Internal helpers for run-lifecycle's teardown commit — not part of the public barrel.
export function notifyRunTeardown(): void {
  teardownListeners.forEach((listener) => listener());
}

export function clearTransientUiOnTeardown(): void {
  useUiStore.getState().clearCardHover();
}
