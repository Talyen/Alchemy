// Reset helper for UI + transient session fields (tests and run teardown).
import { useUiStore } from "./ui-store";
import { useRunSessionStore } from "./run-session-store";

/** Resets UI hover state and transient session fields. */
export function resetScreenStores() {
  useUiStore.setState(useUiStore.getInitialState(), true);
  useRunSessionStore.getState().clearTransientSession();
}
