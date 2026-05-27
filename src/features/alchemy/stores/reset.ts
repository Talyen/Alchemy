// Unified store reset orchestrator for cleaning active combat/run state and persistent data.
// Depends on: useRunStore, useBattleStore, useScreenStore, useHomesteadStore, useAppStore.
// Depended on by: useRunNavigation (resetRunState), App (clearSaveData).
import { defaultBattleState } from "@/lib/battle";
import { createEmptyRewardState } from "../navigation/reward-flow";
import { useRunStore } from "./run-store";
import { useBattleStore } from "./battle-store";
import { useScreenStore } from "./screen-store";
import { useHomesteadStore } from "./homestead-store";
import { useAppStore } from "./app-store";

export function resetActiveRunStores() {
  useBattleStore.getState().setSyncedBattleState(defaultBattleState());
  useBattleStore.getState().clearDisplayOverrides();
  useBattleStore.getState().setHasActiveBattle(false);
  useRunStore.getState().reset();
  useRunStore.getState().resetRunXP();
  useScreenStore.getState().setPendingContentSystemType("campaign");
  useScreenStore.getState().setRewardState(createEmptyRewardState());
  useScreenStore.getState().setMysteryEvent(null);
  useScreenStore.getState().setMysteryCardChoices(null);
  useScreenStore.getState().setHasActiveRun(false);
  useScreenStore.getState().clearCardHover();
}

export function clearAllPersistentGameData() {
  useAppStore.getState().clearSavedAppState();
  useRunStore.getState().clearPermanentData();
  useHomesteadStore.getState().reset();
}
