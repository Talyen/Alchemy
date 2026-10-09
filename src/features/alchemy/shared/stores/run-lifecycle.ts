import { settleRunEnd } from "./write/run-end";
import { setScreen } from "./write/run-navigation";
import { buildAlchemySaveDataFromStores } from "../storage/persistence";
import { saveAlchemySaveData } from "../storage/io";
import { sessionFeedback } from "@/features/alchemy/shared/stores/session-capabilities";
import type { ActiveRunData } from "@/lib/active-run-session";

import type { TalentXP, UnlockedTalents } from "@/lib/game-data";
import { isEditionRunAvailable } from "@/lib/game-edition";

import type { MaterialInventory } from "@/lib/homestead/types";

import { logStorageFailure } from "@/lib/storage-logging";
import { current, isDraft } from "immer";
import type { GameSession } from "./game-session-types";
import { dispatchGameplayCommand, type GameplayDraft } from "./gameplay-command";
import { getRunSession, readHasActiveRun } from "./run-reads";
import { applyRestoreRunToDraft } from "./run-restore";
import { encodeRunResumeSnapshot } from "./run-resume-codec";
import type { RunTransaction } from "./run-session-command";
import { acceptCommand, rejectCommand } from "./run-session-command";
import {
  applyTalentState,
  awardRunEndMaterials,
  finalizeRunXP,
  clearTransientSession,
  cloneRunObtainedItem,
  resetNavigation,
  resetProgress,
  setRunEndCurrencies,
  setRunEndItems,
  setRunEndLabyrinthFloor,
  setRunEndMaterials,
  setRunPlayerHealth,
} from "./run-session-write-port";
import { sessionRuntime } from "./session-runtime";

export function restoreRun(
  activeRun: ActiveRunData | null,
  talentXP: TalentXP,
  unlockedTalents: UnlockedTalents,
  gameSession: GameSession,
  options?: { abandonIncompatibleBattle?: boolean },
): void {
  sessionRuntime(gameSession).progressCompletion.cancel();
  dispatchGameplayCommand(
    (draft) => {
      applyTalentState(draft, talentXP, unlockedTalents);
      applyRestoreRunToDraft(draft, activeRun && isEditionRunAvailable(activeRun) ? activeRun : null);

      const abandoned = Boolean(
        options?.abandonIncompatibleBattle &&
        activeRun &&
        abandonRunInDraft(draft, { awardRunEndMaterials, finalizeRunXP }),
      );
      if (abandoned) setScreen(draft, "game-over");
      return acceptCommand(abandoned);
    },
    {
      afterCommit: (abandoned) => {
        if (abandoned) afterAbandonRun(gameSession);
      },
    },
    gameSession,
  );
}

export function resolveActiveRunForSave(gameSession: GameSession): ActiveRunData | null {
  return readHasActiveRun(gameSession) ? snapshotRun(gameSession) : null;
}

export function snapshotRun(gameSession: GameSession): ActiveRunData {
  return encodeRunResumeSnapshot(getRunSession(undefined, gameSession));
}

export function syncRunToBattleStart(draft: RunTransaction, playerHealth?: number): number {
  const startingHealth = playerHealth ?? draft.run.activeRun.runPlayerHealth;
  setRunPlayerHealth(draft, startingHealth);
  return startingHealth;
}

export function syncBattleToRun(draft: RunTransaction, options?: { playerHealth?: number }): void {
  const health =
    options?.playerHealth ??
    (draft.session.activity.kind === "battle" ? draft.session.activity.data.battleState.playerHealth : null);
  if (health === null) throw new Error("Battle Health synchronization requires an active battle");
  setRunPlayerHealth(draft, health);
}

export function clearActiveRunInDraft(draft: GameplayDraft): void {
  resetProgress(draft);
  resetNavigation(draft);
  clearTransientSession(draft);
}

export function teardownRun(gameSession: GameSession): void {
  dispatchGameplayCommand(
    (draft) => {
      clearActiveRunInDraft(draft);

      return acceptCommand();
    },
    undefined,
    gameSession,
  );
  clearBattleUiState(gameSession);
  notifyRunTeardown(gameSession);
}

function flushSave(activeRun: ActiveRunData | null, message: string, gameSession: GameSession): void {
  // Immediate fast path: run-end and gear mutations need durability without
  // waiting for the autosave debounce. Shares the storage owner’s queue (and the
  // snapshot builder) with the debounced autosave, so overlapping writes
  // coalesce.
  void saveAlchemySaveData(buildAlchemySaveDataFromStores(activeRun, gameSession), gameSession).then(
    (outcome) => {
      if (outcome === "failed") logStorageFailure(message);
    },
    (error: unknown) => {
      logStorageFailure(message, error);
    },
  );
}

export function flushSaveAfterRunEnd(gameSession: GameSession): void {
  flushSave(null, "Failed to flush save after run end", gameSession);
}

export function flushSaveAfterGearMutation(activeRun: ActiveRunData | null, gameSession: GameSession): void {
  flushSave(activeRun, "Failed to flush save after gear mutation", gameSession);
}

export function finalizeRunEndSession(
  options: {
    awardRunEndMaterials: (transaction: RunTransaction) => MaterialInventory;
    finalizeRunXP: (transaction: RunTransaction) => void;
  },
  gameSession: GameSession,
): MaterialInventory {
  return dispatchGameplayCommand(
    (draft) => acceptCommand(settleRunEnd(options, draft, "victory")),
    {
      afterCommit: () => {
        flushSaveAfterRunEnd(gameSession);
      },
    },
    gameSession,
  );
}

/** Manual termination shares earned progression, but does not simulate a defeat. */
export function abandonRun(
  options: {
    awardRunEndMaterials: (transaction: RunTransaction) => MaterialInventory;
    finalizeRunXP: (transaction: RunTransaction) => void;
  },
  gameSession: GameSession,
): boolean {
  return dispatchGameplayCommand(
    (draft) =>
      abandonRunInDraft(draft, options)
        ? acceptCommand(true)
        : rejectCommand("There is no active run to abandon", false),
    { afterCommit: () => afterAbandonRun(gameSession) },
    gameSession,
  );
}

function afterAbandonRun(gameSession: GameSession): void {
  sessionFeedback(gameSession).stopAllSfx();
  clearBattlePresentationUi(gameSession);
  notifyRunTeardown(gameSession);
  flushSaveAfterRunEnd(gameSession);
}
function abandonRunInDraft(draft: GameplayDraft, options: Parameters<typeof abandonRun>[0]): boolean {
  if (draft.session.activity.kind === "inactive") return false;
  settleRunEnd(options, draft, "abandoned");
  // The battle route retains its outgoing display; ending activity removes
  // command access to combat immediately. Preserve the recap
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
  return true;
}

export function applyRunDefeatTeardown(
  options: {
    awardRunEndMaterials: (transaction: RunTransaction) => MaterialInventory;
    finalizeRunXP: (transaction: RunTransaction) => void;
    clearCombatPresentation?: () => void;
  },
  gameSession: GameSession,
): void {
  dispatchGameplayCommand(
    (draft) => {
      settleRunEnd(
        {
          awardRunEndMaterials: options.awardRunEndMaterials,
          finalizeRunXP: options.finalizeRunXP,
        },
        draft,
        "death",
      );
      return acceptCommand();
    },
    {
      afterCommit: () => {
        flushSaveAfterRunEnd(gameSession);
        sessionFeedback(gameSession).stopAllSfx();
        sessionFeedback(gameSession).playDefeat();
        options.clearCombatPresentation?.();
      },
    },
    gameSession,
  );
}

export function onRunTeardown(listener: () => void, gameSession: GameSession): () => void {
  const runtime = sessionRuntime(gameSession);
  return runtime.track(runtime.teardown.on(listener));
}
export function onClearBattlePresentation(listener: () => void, gameSession: GameSession): () => void {
  const runtime = sessionRuntime(gameSession);
  return runtime.track(runtime.clearPresentation.on(listener));
}

function clearBattleUiState(gameSession: GameSession): void {
  sessionRuntime(gameSession).feedback.clearBattleUi();
}
export function clearBattlePresentationUi(gameSession: GameSession): void {
  clearBattleUiState(gameSession);
  sessionRuntime(gameSession).clearPresentation.emit();
}
function notifyRunTeardown(gameSession: GameSession): void {
  sessionRuntime(gameSession).teardown.emit();
}
