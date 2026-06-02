// Reset helper for UI + run-session stores (tests and run teardown).
import { useUiStore } from "./ui-store";
import { useRunSessionStore } from "./run-session-store";

/** Resets both UI and run-session stores (use in tests and run teardown). */
export function resetScreenStores() {
  useUiStore.setState(useUiStore.getInitialState(), true);
  useRunSessionStore.setState(useRunSessionStore.getInitialState(), true);
}
