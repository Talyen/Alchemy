// Typed store accessors for injectable handlers (tests pass mocks; production uses Zustand getState).
import { useRunStore } from "./run-progress-store";
import { useRunSessionStore } from "./run-session-store";
import { useNavigationStore } from "./navigation-store";
import type { RunProgressStore } from "./run-progress-store-types";
import type { RunSessionStore } from "./run-session-store-types";
import type { NavigationStore } from "./navigation-store";

/** Imperative run progression store reads/writes. */
export function getRunProgressStore(): RunProgressStore {
  return useRunStore.getState();
}

/** Imperative session store reads/writes. */
export function getRunSessionStore(): RunSessionStore {
  return useRunSessionStore.getState();
}

/** Imperative navigation store reads/writes. */
export function getNavigationStore(): NavigationStore {
  return useNavigationStore.getState();
}
