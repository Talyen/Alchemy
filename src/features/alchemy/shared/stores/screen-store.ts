// Reset helper for UI + transient session fields (tests and run teardown).
import { useUiStore } from "./ui-store";
import { useActiveRunStore } from "./active-run-store";

/** Resets UI hover state and transient session fields on the active-run store. */
export function resetScreenStores() {
  useUiStore.setState(useUiStore.getInitialState(), true);
  useActiveRunStore.getState().clearTransientSession();
}
