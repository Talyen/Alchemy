// Imperative session-store reads — pair with run-session-actions for writes.
import { getRunSessionStore, type RunSessionStoreState } from "./store-access";

export type { RunSessionStoreState };

export function readRunSessionStore(): RunSessionStoreState {
  return getRunSessionStore();
}
