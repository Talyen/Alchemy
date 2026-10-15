import type { UnstampedSaveData } from "../storage/types";
import { hydrateGameplayPersistenceFields } from "./persistence-hydration";
import { settleRunEnd } from "./write/run-end";
import { setScreen } from "./write/run-navigation";
import { buildAlchemySaveDataFromStores } from "../storage/persistence";
import { saveAlchemySaveData } from "../storage/io";
import { sessionFeedback } from "@/features/alchemy/shared/stores/session-capabilities";
import type { ActiveRunData, RunRecap } from "@/lib/active-run-session";

import type { TalentXP, UnlockedTalents } from "@/lib/game-data";
import { isEditionRunAvailable } from "@/lib/game-edition";

import { logStorageFailure } from "@/lib/storage-logging";
import type { GameSession } from "./game-session-types";
import { dispatchGameplayCommand, type GameplayDraft } from "./gameplay-command";
import { readHasActiveRun } from "./run-reads";
import { applyRestoreRunToDraft } from "./run-restore";
import { encodeRunResumeSnapshot } from "./run-resume-codec";
import type { RunTransaction } from "./run-session-command";
import { acceptCommand, rejectCommand } from "./run-session-command";
import {
  applyTalentState,
  clearTransientSession,
  resetNavigation,
  resetProgress,
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
  dispatchGameplayCommand(
    (draft) => {
      const abandoned = restoreRunInDraft(draft, activeRun, talentXP, unlockedTalents, options);
      return acceptCommand(abandoned);
    },
    {
      restore: {},
      afterCommit: (abandoned) => {
        if (abandoned) afterAbandonRun(gameSession);
      },
    },
    gameSession,
  );
}

function restoreRunInDraft(
  draft: GameplayDraft,
  activeRun: ActiveRunData | null,
  talentXP: TalentXP,
  unlockedTalents: UnlockedTalents,
  options?: { abandonIncompatibleBattle?: boolean },
): boolean {
  applyTalentState(draft, talentXP, unlockedTalents);
  applyRestoreRunToDraft(draft, activeRun && isEditionRunAvailable(activeRun) ? activeRun : null);
  const abandoned = Boolean(options?.abandonIncompatibleBattle && activeRun && settleRunEnd(draft, "abandoned"));
  if (abandoned) setScreen(draft, "game-over");
  return abandoned;
}

/** Permanent progression and its resumable activity publish as one gameplay revision. */
export function restoreSessionSave(
  save: UnstampedSaveData,
  gameSession: GameSession,
  options?: { preserveActiveRunIfInitialized?: boolean; abandonIncompatibleBattle?: boolean },
): boolean {
  const result = dispatchGameplayCommand(
    (draft) => {
      const preserve = Boolean(options?.preserveActiveRunIfInitialized && draft.run.initialized);
      hydrateGameplayPersistenceFields(save, draft);
      const abandoned = preserve
        ? false
        : restoreRunInDraft(draft, save.activeRun, save.talentXP, save.unlockedTalents, options);
      return acceptCommand({ restored: !preserve, abandoned });
    },
    { restore: { settings: save } },
    gameSession,
  );
  if (result.abandoned) afterAbandonRun(gameSession);
  return result.restored;
}

export function resolveActiveRunForSave(gameSession: GameSession): ActiveRunData | null {
  return readHasActiveRun(gameSession) ? snapshotRun(gameSession) : null;
}

export function snapshotRun(gameSession: GameSession): ActiveRunData {
  const state = sessionRuntime(gameSession).gameplay.reads.getState();
  return encodeRunResumeSnapshot({ run: state.run.activeRun, session: state.session });
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
  sessionRuntime(gameSession).lifecycle.teardown();
}

function flushSave(message: string, gameSession: GameSession): void {
  // Immediate fast path: run-end and gear mutations need durability without
  // waiting for the autosave debounce. Shares the storage owner’s queue (and the
  // snapshot builder) with the debounced autosave, so overlapping writes
  // coalesce.
  let save: UnstampedSaveData;
  try {
    save = buildAlchemySaveDataFromStores(gameSession);
  } catch (error) {
    logStorageFailure(message, error);
    return;
  }
  void saveAlchemySaveData(save, gameSession).then(
    (outcome) => {
      if (outcome === "failed") logStorageFailure(message);
    },
    (error: unknown) => {
      logStorageFailure(message, error);
    },
  );
}

export function flushSaveAfterRunEnd(gameSession: GameSession): void {
  flushSave("Failed to flush save after run end", gameSession);
}

export function flushSaveAfterGearMutation(gameSession: GameSession): void {
  flushSave("Failed to flush save after gear mutation", gameSession);
}

function commitRunEnd(ending: RunRecap["ending"], afterCommit: () => void, gameSession: GameSession): boolean {
  return dispatchGameplayCommand(
    (draft) => {
      const result = settleRunEnd(draft, ending);
      return result ? acceptCommand(true) : rejectCommand("There is no active run to end", false);
    },
    { afterCommit },
    gameSession,
  );
}

export function finalizeRunEndSession(gameSession: GameSession): boolean {
  return commitRunEnd("victory", () => flushSaveAfterRunEnd(gameSession), gameSession);
}

/** Manual termination shares earned progression, but does not simulate a defeat. */
export function abandonRun(gameSession: GameSession): boolean {
  return commitRunEnd("abandoned", () => afterAbandonRun(gameSession), gameSession);
}

function afterAbandonRun(gameSession: GameSession): void {
  flushSaveAfterRunEnd(gameSession);
  sessionRuntime(gameSession).lifecycle.teardown();
  sessionFeedback(gameSession).stopAllSfx();
}

export function applyRunDefeatTeardown(gameSession: GameSession): void {
  commitRunEnd(
    "death",
    () => {
      flushSaveAfterRunEnd(gameSession);
      sessionRuntime(gameSession).lifecycle.teardown();
      sessionFeedback(gameSession).stopAllSfx();
      sessionFeedback(gameSession).playDefeat();
    },
    gameSession,
  );
}

export function onRunTeardown(listener: () => void, gameSession: GameSession): () => void {
  const runtime = sessionRuntime(gameSession);
  return runtime.track(runtime.lifecycle.onTeardown(listener));
}
/** Cancellation only: runs during restore publication, before store observers. */
export function onRunRestored(listener: () => void, gameSession: GameSession): () => void {
  const runtime = sessionRuntime(gameSession);
  return runtime.track(runtime.lifecycle.onRestore(listener));
}
export function onClearBattlePresentation(listener: () => void, gameSession: GameSession): () => void {
  const runtime = sessionRuntime(gameSession);
  return runtime.track(runtime.lifecycle.onClearPresentation(listener));
}

export function clearBattlePresentationUi(gameSession: GameSession): void {
  sessionRuntime(gameSession).lifecycle.clearPresentation();
}
