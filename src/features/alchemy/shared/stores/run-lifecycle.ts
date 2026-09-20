import { playDefeat, stopAllSfx } from "@/lib/audio";
import { current, isDraft } from "immer";
import type { ActiveRunData, RunRecap } from "@/lib/active-run-session";
import type { Screen } from "@/lib/routing";
import type { TalentXP, UnlockedTalents } from "@/lib/game-data";
import { buildAlchemySaveDataFromStores, saveAlchemySaveData } from "@/features/alchemy/shared/storage";
import { emptyInventory } from "@/lib/homestead/inventory";
import { logStorageFailure } from "@/lib/storage-logging";
import type { MaterialInventory } from "@/lib/homestead/types";
import { getRunSession, readRunResumeScreen } from "./run-reads";
import { encodeRunResumeSnapshot } from "./run-resume-codec";
import { dispatchRunSessionCommand, type GameplayDraft } from "./run-session-command";
import {
  applyTalentState,
  captureRunRecap,
  clearTransientSession,
  cloneRunObtainedItem,
  initializeActiveBattle,
  resetNavigation,
  resetProgress,
  setFinishedRunCharacters,
  setHasActiveBattle,
  setHasActiveRun,
  setRunEndCurrencies,
  setRunEndItems,
  setRunEndLabyrinthFloor,
  setRunEndMaterials,
  setRunPlayerHealth,
} from "./run-session-write-port";
import { applyRestoreRunToDraft } from "./run-restore";
import { CONTENT_SYSTEMS } from "@/lib/content-systems/types";
import { useUiStore } from "./ui-store";

export function restoreRun(
  activeRun: ActiveRunData | null,
  talentXP: TalentXP,
  unlockedTalents: UnlockedTalents,
): void {
  dispatchRunSessionCommand((draft) => {
    applyTalentState(draft, talentXP, unlockedTalents);
    applyRestoreRunToDraft(draft, activeRun);
  });
}

export function resolveActiveRunForSave(hasActiveRun: boolean, screen?: Screen): ActiveRunData | null {
  return hasActiveRun ? snapshotRun(screen) : null;
}

export function snapshotRun(screen?: Screen): ActiveRunData {
  return encodeRunResumeSnapshot(getRunSession(), screen ?? readRunResumeScreen() ?? undefined);
}

export function syncRunToBattleStart(draft: GameplayDraft, playerHealth?: number): number {
  const startingHealth = playerHealth ?? draft.run.activeRun.runPlayerHealth;
  setRunPlayerHealth(draft, startingHealth);
  return startingHealth;
}

export function syncBattleToRun(draft: GameplayDraft, options?: { playerHealth?: number }): void {
  const health = options?.playerHealth ?? draft.battle.battleState.playerHealth;
  setRunPlayerHealth(draft, health);
}

export function clearActiveRunInDraft(draft: GameplayDraft): void {
  resetProgress(draft);
  resetNavigation(draft);
  clearTransientSession(draft);
  initializeActiveBattle(draft, null);
}

export function teardownRun(): void {
  dispatchRunSessionCommand((draft) => {
    clearActiveRunInDraft(draft);
  });
  clearBattleUiState();
  notifyRunTeardown();
}

function flushSave(activeRun: ActiveRunData | null, message: string): void {
  // Immediate fast path: run-end and gear mutations need durability without
  // waiting for the autosave debounce. Shares sharedSaveQueue (and the
  // snapshot builder) with the debounced autosave, so overlapping writes
  // coalesce. saveAlchemySaveData never rejects (failures resolve "failed"),
  // so handle the outcome explicitly: the debounced scheduler write scheduled
  // by the same store commit retries on failure. The rejection handler is
  // defensive only, so an unexpected throw still reports instead of going
  // unhandled.
  void saveAlchemySaveData(buildAlchemySaveDataFromStores(activeRun)).then(
    (outcome) => {
      if (outcome === "failed") logStorageFailure(message);
    },
    (error: unknown) => {
      logStorageFailure(message, error);
    },
  );
}

function flushSaveAfterRunEnd(): void {
  flushSave(null, "Failed to flush save after run end");
}

export function flushSaveAfterGearMutation(activeRun: ActiveRunData | null): void {
  flushSave(activeRun, "Failed to flush save after gear mutation");
}

function finalizeRunEndSessionState(
  options: {
    awardRunEndMaterials: (draft: GameplayDraft) => MaterialInventory;
    finalizeRunXP: (draft: GameplayDraft) => void;
  },
  draft: GameplayDraft,
  ending: RunRecap["ending"],
): MaterialInventory {
  const session = draft.session;

  if (session.activity.kind === "inactive") {
    return emptyInventory();
  }

  captureRunRecap(draft, ending);
  const activeChar = draft.run.activeRun.characterId;
  setFinishedRunCharacters(draft, (prev) => {
    if (prev.includes(activeChar)) return prev;
    return [...prev, activeChar];
  });

  const homesteadBonus = options.awardRunEndMaterials(draft);
  options.finalizeRunXP(draft);
  setRunEndItems(draft, draft.run.activeRun.runObtainedItems.map(cloneRunObtainedItem));
  if (draft.run.activeRun.contentSystemType === CONTENT_SYSTEMS.LABYRINTH) {
    const floor = draft.session.labyrinthMap?.currentFloor ?? null;
    setRunEndLabyrinthFloor(draft, floor);
  }

  setHasActiveRun(draft, false);
  return homesteadBonus;
}

export function finalizeRunEndSession(options: {
  awardRunEndMaterials: (draft: GameplayDraft) => MaterialInventory;
  finalizeRunXP: (draft: GameplayDraft) => void;
}): MaterialInventory {
  return dispatchRunSessionCommand((draft) => finalizeRunEndSessionState(options, draft, "victory"), {
    afterCommit: () => {
      flushSaveAfterRunEnd();
    },
  });
}

/** Manual termination shares earned progression, but does not simulate a defeat. */
export function abandonRun(options: {
  awardRunEndMaterials: (draft: GameplayDraft) => MaterialInventory;
  finalizeRunXP: (draft: GameplayDraft) => void;
}): boolean {
  return dispatchRunSessionCommand(
    (draft) => {
      if (draft.session.activity.kind === "inactive") return false;
      finalizeRunEndSessionState(options, draft, "abandoned");
      // The outgoing battle still renders until the route transition completes.
      // Retain its last snapshot, but remove all resumable activity and continuations.
      // clearTransientSession resets the whole session, so preserve the recap
      // snapshot: manual End Run always shows the End Run screen. Copy the
      // values first so the recap never holds revoked draft proxies.
      const runRecap = isDraft(draft.session.runRecap) ? current(draft.session.runRecap) : draft.session.runRecap;
      const runEndMaterials = { ...draft.session.runEndMaterials };
      const runEndCurrencies = { ...draft.session.runEndCurrencies };
      const runEndTalentXP = { ...draft.session.runEndTalentXP };
      const runEndItems = draft.session.runEndItems.map(cloneRunObtainedItem);
      const runEndLabyrinthFloor = draft.session.runEndLabyrinthFloor;
      clearTransientSession(draft);
      draft.session.runRecap = runRecap;
      setRunEndMaterials(draft, runEndMaterials);
      setRunEndCurrencies(draft, runEndCurrencies);
      // No write-port setter: finalizeRunXP owns runEndTalentXP.
      draft.session.runEndTalentXP = runEndTalentXP;
      setRunEndItems(draft, runEndItems);
      setRunEndLabyrinthFloor(draft, runEndLabyrinthFloor);
      setHasActiveBattle(draft, false);
      draft.battle.pendingBattleTransition = null;
      draft.battle.pendingTransitionResumeRequired = false;
      return true;
    },
    {
      afterCommit: (ended) => {
        if (!ended) return;
        stopAllSfx();
        clearBattlePresentationUi();
        notifyRunTeardown();
        flushSaveAfterRunEnd();
      },
    },
  );
}

export function applyRunDefeatTeardown(options: {
  awardRunEndMaterials: (draft: GameplayDraft) => MaterialInventory;
  finalizeRunXP: (draft: GameplayDraft) => void;
  clearCombatState: (draft: GameplayDraft) => void;
  clearCombatPresentation?: () => void;
}): void {
  dispatchRunSessionCommand(
    (draft) => {
      finalizeRunEndSessionState(
        {
          awardRunEndMaterials: options.awardRunEndMaterials,
          finalizeRunXP: options.finalizeRunXP,
        },
        draft,
        "death",
      );
      options.clearCombatState(draft);
    },
    {
      afterCommit: () => {
        flushSaveAfterRunEnd();
        stopAllSfx();
        playDefeat();
        options.clearCombatPresentation?.();
      },
    },
  );
}

type LifecycleListener = () => void;

function createLifecycleChannel() {
  const listeners = new Set<LifecycleListener>();
  return {
    on(listener: LifecycleListener): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    emit(): void {
      listeners.forEach((listener) => listener());
    },
  };
}

const runTeardownChannel = createLifecycleChannel();
const clearPresentationChannel = createLifecycleChannel();

export function onRunTeardown(listener: LifecycleListener): () => void {
  return runTeardownChannel.on(listener);
}

export function onClearBattlePresentation(listener: LifecycleListener): () => void {
  return clearPresentationChannel.on(listener);
}

export function clearBattleUi(): void {
  dispatchRunSessionCommand((draft) => setHasActiveBattle(draft, false));
  clearBattlePresentationUi();
}

function clearBattleUiState(): void {
  useUiStore.getState().setCardInspection(null);
  useUiStore.getState().setEnemyInspectionOpen(false);
  useUiStore.getState().clearCardHover();
}

export function clearBattlePresentationUi(): void {
  clearBattleUiState();
  clearPresentationChannel.emit();
}

function notifyRunTeardown(): void {
  runTeardownChannel.emit();
}
