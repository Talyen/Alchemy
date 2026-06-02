// Unified store reset orchestrator for cleaning active combat/run state and persistent data.
// Depends on: useRunStore, useBattleStore, useUiStore, useRunSessionStore, useHomesteadStore, useAppStore.
// Depended on by: useRunNavigation (resetRunState), App (clearSaveData).
import { defaultBattleState } from "@/lib/battle";
import { createEmptyRewardState } from "../navigation/reward-flow";
import { useRunStore } from "./run-store";
import { useBattleStore } from "./battle-store";
import { useBattlePresentationStore } from "./battle-presentation-store";
import { useUiStore } from "./ui-store";
import { useRunSessionStore } from "./run-session-store";
import { useHomesteadStore } from "./homestead-store";
import { useAppStore } from "./app-store";

/** Prefer {@link teardownRun} from run-session-facade at call sites outside this module. */
export function resetActiveRunStores() {
  useBattleStore.getState().setSyncedBattleState(defaultBattleState());
  useBattleStore.getState().clearDisplayOverrides();
  useBattlePresentationStore.getState().resetPresentation();
  useBattleStore.getState().setHasActiveBattle(false);
  useRunStore.getState().reset();
  useRunSessionStore.getState().setPendingContentSystemType("campaign");
  useRunSessionStore.getState().setRewardState(createEmptyRewardState());
  useRunSessionStore.getState().setMysteryEvent(null);
  useRunSessionStore.getState().setMysteryCardChoices(null);
  useRunSessionStore.getState().setRunEndTalentXP({});
  useRunSessionStore.getState().setHasActiveRun(false);
  useUiStore.getState().clearCardHover();
}

export function clearAllPersistentGameData() {
  useAppStore.getState().clearSavedAppState();
  useRunStore.getState().clearPermanentData();
  useHomesteadStore.getState().reset();
}
