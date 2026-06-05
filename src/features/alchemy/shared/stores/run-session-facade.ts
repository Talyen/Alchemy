// Facade over run domain store — sync, snapshot, restore, and teardown.
import { useShallow } from "zustand/react/shallow";
import type { UnlockedTalents } from "@/lib/game-data";
import type { ActiveRunData } from "@/lib/active-run-session";
import type { Screen } from "@/lib/routing";
import type { TalentXP } from "@/lib/talents";
import { getRunSession } from "./run-session-model";
import { getRunDomainStore, useRunDomainStore } from "./run-domain-store";
import { readActiveRunStore, readBattleStore } from "./run-session-read";
import {
  applyRunDefeatTeardown,
  flushPersistedSave,
  flushSaveAfterRunEnd,
  restoreRunFromSnapshot,
  snapshotRunFromDomain,
  syncBattleToRun,
  syncRunToBattleStart,
  teardownRun,
} from "./run-transitions";

export {
  getRunSession,
  useRunSession,
  useRunSessionBattleContext,
  useRunSessionBattleSlice,
  useRunSessionLabyrinthSlice,
  useRunSessionMysterySlice,
  useRunSessionNavigationSlice,
  useRunSessionRunSlice,
  useRunSessionShopSlice,
  useRunSessionTransientSlice,
} from "./run-session-model";
export { setActiveLabyrinthModifiers, setActiveLabyrinthRewardModifiers } from "./run-session-actions";
export {
  applyRunDefeatTeardown,
  flushPersistedSave,
  flushSaveAfterRunEnd,
  restoreRunFromSnapshot,
  snapshotRunFromDomain,
  syncBattleToRun,
  syncRunToBattleStart,
  teardownRun,
};

/** Current screen and setter (owned by run domain navigation slice). */
export function useActiveRunScreen() {
  return useRunDomainStore(useShallow((s) => ({ screen: s.navigation.screen, setScreen: s.setScreen })));
}

/** Subscribe to navigation screen only (autosave, routing). */
export function useActiveRunScreenValue(): Screen {
  return useRunDomainStore((s) => s.navigation.screen);
}

/** Map-layer gold plus in-combat gold (e.g. victory totals). */
export function getCombinedRunGold(runGold?: number, battleGold?: number): number {
  const run = runGold ?? readActiveRunStore().runGold;
  const battle = battleGold ?? readBattleStore().battleState.gold;
  return run + battle;
}

/** Current lifecycle phase from live stores and the active screen. */
export function getCurrentRunPhase(screen?: Screen) {
  return getRunSession(screen).phase;
}

/** Serialize all run-related stores into persisted ActiveRunData. */
export function buildActiveRunSnapshotFromStores(screen?: Screen): ActiveRunData {
  return snapshotRunFromDomain(screen);
}

/** Apply persisted active-run data to Zustand stores (bootstrap / resume). */
export function restoreActiveRunToStores(
  activeRun: ActiveRunData | null,
  talentXP: TalentXP,
  unlockedTalents: UnlockedTalents,
): void {
  restoreRunFromSnapshot(activeRun, talentXP, unlockedTalents);
}

/** Whether run domain bootstrap has completed. */
export function readActiveRunInitialized(): boolean {
  return getRunDomainStore().progress.initialized;
}
