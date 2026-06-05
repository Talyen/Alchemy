// Reset helper for UI + transient session fields (tests and run teardown).
import { useUiStore } from "./ui-store";
import { getRunDomainStore } from "./run-domain-store";

/** Resets UI hover state and transient session fields. */
export function resetScreenStores() {
  useUiStore.setState(useUiStore.getInitialState(), true);
  getRunDomainStore().clearTransientSession();
}
