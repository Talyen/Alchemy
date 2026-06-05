// Typed store accessors for injectable handlers (tests pass mocks; production uses Zustand getState).
import { useActiveRunStore } from "./active-run-store";
import type { ActiveRunStore } from "./active-run-store-types";

export type RunSessionStoreState = ActiveRunStore;

/** Imperative active-run store reads/writes (run + session + screen). */
export function getActiveRunStore(): ActiveRunStore {
  return useActiveRunStore.getState();
}

/** @deprecated Use {@link getActiveRunStore}. */
export function getRunSessionStore(): ActiveRunStore {
  return getActiveRunStore();
}
