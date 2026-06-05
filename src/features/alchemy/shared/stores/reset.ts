// Unified store reset orchestrator for cleaning active combat/run state and persistent data.
// Depends on: useRunStore, useBattleStore, useUiStore, useRunSessionStore, useHomesteadStore, useAppStore.
// Depended on by: useRunNavigation (resetRunState), App (clearSaveData).
import { defaultBattleState } from "@/lib/battle";
import { useActiveRunStore } from "./active-run-store";
import { useBattleStore } from "./battle-store";
import { useBattlePresentationStore } from "./battle-presentation-store";
import { useUiStore } from "./ui-store";
import { clearTransientRunSessionState } from "./run-session-actions";
import { useHomesteadStore } from "./homestead-store";
import { useAppStore } from "./app-store";

/** Prefer {@link teardownRun} from run-session-facade at call sites outside this module. */
export function resetActiveRunStores() {
  useBattleStore.getState().setSyncedBattleState(defaultBattleState());
  useBattleStore.getState().clearDisplayOverrides();
  useBattlePresentationStore.getState().resetPresentation();
  useBattleStore.getState().setHasActiveBattle(false);
  useActiveRunStore.getState().reset();
  clearTransientRunSessionState();
  useActiveRunStore.getState().setScreen("menu");
  useUiStore.getState().clearCardHover();
}

export function clearAllPersistentGameData() {
  useAppStore.getState().clearSavedAppState();
  useActiveRunStore.getState().clearPermanentData();
  useHomesteadStore.getState().reset();
}
