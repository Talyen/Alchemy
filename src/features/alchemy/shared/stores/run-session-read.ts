import { getRunProgressStore, getRunSessionStore } from "./store-access";
import type { RunProgressStore } from "./run-progress-store-types";
import type { RunSessionStore } from "./run-session-store-types";

/** Imperative read of run progression fields (deck, gold, talents, initialized). */
export function readActiveRunStore(): RunProgressStore {
  return getRunProgressStore();
}

/** Imperative read of transient session fields (shops, labyrinth, mystery). */
export function readRunSessionStore(): RunSessionStore {
  return getRunSessionStore();
}
