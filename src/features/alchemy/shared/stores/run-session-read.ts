// Imperative active-run reads — pair with run-session-actions for writes.
import { getActiveRunStore, getRunSessionStore, type RunSessionStoreState } from "./store-access";

export type { RunSessionStoreState };

export function readActiveRunStore(): RunSessionStoreState {
  return getActiveRunStore();
}

/** @deprecated Use {@link readActiveRunStore}. */
export function readRunSessionStore(): RunSessionStoreState {
  return getRunSessionStore();
}
