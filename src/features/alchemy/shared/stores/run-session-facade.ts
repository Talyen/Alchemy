// Facade over run, session, navigation, and battle stores — sync, snapshot, restore, and teardown.
import { useShallow } from "zustand/react/shallow";
import type { UnlockedTalents } from "@/lib/game-data";
import {
  buildActiveRunSnapshot,
  restoreActiveRun,
  type ActiveRunData,
  type ActiveRunHydrationTargets,
} from "@/lib/active-run-session";
import type { Screen } from "@/lib/routing";
import type { TalentXP } from "@/lib/talents";
import { getRunSession } from "./run-session-model";
import type { Destination } from "../types";
import { useRunStore } from "./run-progress-store";
import { useNavigationStore } from "./navigation-store";
import { useBattleStore } from "./battle-store";
import { initializeActiveRunStores } from "./run-store-sync";
import {
  applyDestinationChoices as applyDestinationChoicesToSession,
  setActiveLabyrinthModifiers,
  setActiveLabyrinthPendingNode,
  setActiveLabyrinthRewardModifiers,
  setHasActiveRun,
  setLabyrinthMap,
} from "./run-session-actions";

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
  flushPersistedSave,
  flushSaveAfterRunEnd,
  syncBattleToRun,
  syncRunToBattleStart,
  teardownRun,
} from "./run-lifecycle-coordinator";

/** Current screen and setter (owned by navigation-store). */
export function useActiveRunScreen() {
  return useNavigationStore(useShallow((s) => ({ screen: s.screen, setScreen: s.setScreen })));
}

/** Subscribe to navigation screen only (autosave, routing). */
export function useActiveRunScreenValue(): Screen {
  return useNavigationStore((s) => s.screen);
}

/** Map-layer gold plus in-combat gold (e.g. victory totals). */
export function getCombinedRunGold(runGold?: number, battleGold?: number): number {
  const run = runGold ?? useRunStore.getState().runGold;
  const battle = battleGold ?? useBattleStore.getState().battleState.gold;
  return run + battle;
}

/** Current lifecycle phase from live stores and the active screen. */
export function getCurrentRunPhase(screen?: Screen) {
  return getRunSession(screen).phase;
}

/** Serialize all run-related stores into persisted ActiveRunData. */
export function buildActiveRunSnapshotFromStores(screen?: Screen): ActiveRunData {
  const { run, session, battle } = getRunSession(screen);
  return buildActiveRunSnapshot({
    characterId: run.characterId,
    runDeck: run.runDeck,
    runGold: run.runGold,
    runPlayerHealth: run.runPlayerHealth,
    runMaxHealth: run.runMaxHealth,
    roomsEncountered: run.roomsEncountered,
    currentAct: run.currentAct,
    destinationIndexInAct: run.destinationIndexInAct,
    completedDestinations: run.completedDestinations,
    runTrinkets: run.runTrinkets,
    encounteredRunEnemyIds: run.encounteredRunEnemyIds,
    selectedDifficulty: run.selectedDifficulty,
    contentSystemType: run.contentSystemType,
    labyrinthMap: session.labyrinthMap,
    hasActiveBattle: battle.hasActiveBattle,
    battleState: battle.battleState,
    labyrinthPendingNode: session.activeLabyrinthPendingNode,
    activeLabyrinthModifiers: session.activeLabyrinthModifiers,
    activeLabyrinthRewardModifiers: session.activeLabyrinthRewardModifiers,
    runTalentXP: run.runTalentXP,
    currentScreen: screen ?? useNavigationStore.getState().screen,
    destinationChoices: session.rewardState.destinations,
  });
}

function createDefaultHydrationTargets(): ActiveRunHydrationTargets {
  return {
    runStore: { initialize: initializeActiveRunStores },
    battleStore: useBattleStore.getState(),
    screenStore: {
      setHasActiveRun,
      setLabyrinthMap,
      setActiveLabyrinthModifiers,
      setActiveLabyrinthRewardModifiers,
      setActiveLabyrinthPendingNode,
      applyDestinationChoices: (choices) => applyDestinationChoicesToSession(choices as Destination[]),
    },
  };
}

/** Apply persisted active-run data to Zustand stores (bootstrap / resume). */
export function restoreActiveRunToStores(
  activeRun: ActiveRunData | null,
  talentXP: TalentXP,
  unlockedTalents: UnlockedTalents,
  targets: ActiveRunHydrationTargets = createDefaultHydrationTargets(),
): void {
  restoreActiveRun(activeRun, talentXP, unlockedTalents, targets);
}
