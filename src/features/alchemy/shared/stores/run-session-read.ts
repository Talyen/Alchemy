// Imperative reads of run domain slices.
import {
  getBattleStoreView,
  getRunDomainStore,
  getRunProgressStoreView,
  getRunSessionStoreView,
} from "./run-domain-store";
import type { RunProgressStore } from "./run-progress-store-types";
import type { RunSessionStore } from "./run-session-store-types";

/** Imperative read of run progression fields (deck, gold, talents, initialized). */
export function readActiveRunStore(): RunProgressStore {
  return getRunProgressStoreView();
}

/** Imperative read of transient session fields (shops, labyrinth, mystery). */
export function readRunSessionStore(): RunSessionStore {
  return getRunSessionStoreView();
}

/** Imperative read of navigation screen. */
export function readNavigationScreen() {
  return getRunDomainStore().navigation.screen;
}

/** Imperative read of battle domain slice. */
export function readBattleStore() {
  return getBattleStoreView();
}
