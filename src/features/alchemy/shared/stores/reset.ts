// Unified store reset orchestrator for cleaning active combat/run state and persistent data.
import { defaultBattleState } from "@/lib/battle";
import { useRunStore } from "./run-progress-store";
import { useBattleStore } from "./battle-store";
import { useBattlePresentationStore } from "./battle-presentation-store";
import { useUiStore } from "./ui-store";
import { clearTransientRunSessionState } from "./run-session-actions";
import { useNavigationStore } from "./navigation-store";
import { useHomesteadStore } from "./homestead-store";
import { useAppStore } from "./app-store";

/** Prefer {@link teardownRun} from run-lifecycle-coordinator at call sites outside this module. */
export function resetActiveRunStores() {
  useBattleStore.getState().setSyncedBattleState(defaultBattleState());
  useBattleStore.getState().clearDisplayOverrides();
  useBattlePresentationStore.getState().resetPresentation();
  useBattleStore.getState().setHasActiveBattle(false);
  useRunStore.getState().reset();
  clearTransientRunSessionState();
  useNavigationStore.getState().reset();
  useUiStore.getState().clearCardHover();
}

export function clearAllPersistentGameData() {
  useAppStore.getState().clearSavedAppState();
  useRunStore.getState().clearPermanentData();
  useHomesteadStore.getState().reset();
}
