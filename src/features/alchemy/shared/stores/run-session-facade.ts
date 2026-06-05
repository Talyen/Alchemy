// Facade over run, battle, and session stores — single entry for sync, snapshot, restore, and teardown.
import { useShallow } from "zustand/react/shallow";
import type { UnlockedTalents } from "@/lib/game-data";
import { getBattleStartPlayerHealth } from "@/lib/battle";
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
import { useActiveRunStore } from "./active-run-store";
import { useBattleStore } from "./battle-store";
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

/** Current screen and setter (Phase 4 — owned by active-run-store). */
export function useActiveRunScreen() {
  return useActiveRunStore(useShallow((s) => ({ screen: s.screen, setScreen: s.setScreen })));
}

/** Subscribe to navigation screen only (autosave, routing). */
export function useActiveRunScreenValue(): Screen {
  return useActiveRunStore((s) => s.screen);
}

/** Map-layer gold plus in-combat gold (e.g. victory totals). */
export function getCombinedRunGold(runGold?: number, battleGold?: number): number {
  const run = runGold ?? useActiveRunStore.getState().runGold;
  const battle = battleGold ?? useBattleStore.getState().battleState.gold;
  return run + battle;
}

/** Clamp run HP for battle entry and persist to the run store before creating BattleState. */
export function syncRunToBattleStart(playerHealth?: number): number {
  const run = useActiveRunStore.getState();
  const startingHealth =
    playerHealth ?? getBattleStartPlayerHealth(run.runPlayerHealth, run.runMaxHealth, run.runTrinkets);
  run.setRunPlayerHealth(startingHealth);
  return startingHealth;
}

/** Persist combat HP to the run store after victory or when leaving battle. */
export function syncBattleToRun(options?: { playerHealth?: number }): void {
  const battle = useBattleStore.getState().battleState;
  const health = options?.playerHealth ?? battle.playerHealth;
  useActiveRunStore.getState().setRunPlayerHealth(health);
}

/** Clear active combat and transient run UI stores. */
export { resetActiveRunStores as teardownRun } from "./reset";

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
    currentScreen: screen ?? useActiveRunStore.getState().screen,
    destinationChoices: session.rewardState.destinations,
  });
}

function createDefaultHydrationTargets(): ActiveRunHydrationTargets {
  return {
    runStore: useActiveRunStore.getState(),
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
