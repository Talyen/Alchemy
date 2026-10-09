import { logStorageFailure } from "@/lib/storage-logging";
import type { ProgressCompletion } from "./progress-completion";
import type { ProgressSaveState } from "./progress-completion";
import type { GameSession } from "../stores/game-session-types";
import { resolveActiveRunForSave, restoreRun } from "../stores/run-lifecycle";
import { readRunInitialized } from "../stores/run-reads";
import {
  bindSessionCapabilities,
  markSessionProgress,
  readSessionRevision,
  registerSessionCleanup,
  sessionProgressCompletion,
} from "../stores/session-capabilities";
import {
  clearAlchemySaveData,
  configureSaveBackend,
  getSaveWriteFailure,
  loadAlchemySaveState,
  resetStorageIoForTests,
  routeWritesToRecovery,
  saveAlchemySaveData,
  saveAlchemySaveDataForExit,
  setWritesDisabled,
  subscribeSaveCancellation,
  subscribeSaveWriteFailure,
  waitForPendingSaveWrites,
} from "./io";
import {
  buildAlchemySaveDataFromStores,
  hydrateAlchemyPersistenceFields,
  subscribeAlchemyPersistence,
} from "./persistence";
import { configureAlchemySaveBackend } from "./bootstrap-save-state";
import type { SaveBackend } from "@/lib/platform-save-backend";
import type { SaveLoadState, SaveRestoreAction } from "./save-candidates";
import type { SaveWriteOutcome } from "./save-write-queue";
import type { UnstampedSaveData } from "./types";

export interface SessionPersistenceRestoreOptions {
  restoreActions?: readonly SaveRestoreAction[] | undefined;
  preserveActiveRunIfInitialized?: boolean;
}

export interface SessionPersistence {
  readonly readProgress: () => ProgressSaveState;
  readonly subscribeProgress: (listener: () => void) => () => void;
  readonly trackProgress: (retry: () => void) => () => void;
  readonly checkpoint: () => Promise<SaveWriteOutcome>;
  readonly retryProgress: () => void;
  readonly afterProgressSaved: (run: () => void) => void;
  readonly snapshot: () => UnstampedSaveData;
  readonly restore: (save: UnstampedSaveData, options?: SessionPersistenceRestoreOptions) => boolean;
  readonly configure: (backend: SaveBackend) => void;
  readonly configurePlatform: () => Promise<void>;
  readonly load: () => Promise<SaveLoadState>;
  readonly write: (save: UnstampedSaveData) => Promise<SaveWriteOutcome>;
  readonly writeOnExit: (save: UnstampedSaveData) => Promise<SaveWriteOutcome>;
  readonly waitForWrites: () => Promise<void>;
  readonly clear: (mode?: "default" | "localWipe") => Promise<boolean>;
  readonly routeToRecovery: () => void;
  readonly setWritesDisabled: (disabled: boolean) => void;
  readonly resetForTests: () => Promise<void>;
  readonly subscribe: (listener: () => void) => () => void;
  readonly subscribeCancellation: (listener: () => void) => () => void;
  readonly readFailure: () => boolean;
  readonly subscribeFailure: (listener: () => void) => () => void;
}

export function snapshotSessionSave(gameSession: GameSession) {
  return buildAlchemySaveDataFromStores(resolveActiveRunForSave(gameSession), gameSession);
}

export function createSessionPersistence(gameSession: GameSession): SessionPersistence {
  const progress = sessionProgressCompletion(gameSession);
  const snapshots = new WeakMap<UnstampedSaveData, ReturnType<ProgressCompletion["token"]>>();
  const snapshot = () => {
    const token = progress.token(readSessionRevision(gameSession));
    let save: UnstampedSaveData;
    try {
      save = snapshotSessionSave(gameSession);
    } catch (error) {
      progress.complete(token, "failed");
      throw error;
    }
    snapshots.set(save, token);
    return save;
  };
  const write = async (save: UnstampedSaveData, exit = false) => {
    const token = snapshots.get(save);
    const outcome = await (exit
      ? saveAlchemySaveDataForExit(save, gameSession)
      : saveAlchemySaveData(save, gameSession));
    return token ? progress.complete(token, outcome) : outcome;
  };
  const checkpoint = () => {
    markSessionProgress(gameSession);
    try {
      return write(snapshot());
    } catch (error) {
      logStorageFailure("Progress snapshot could not be built", error);
      return Promise.resolve("failed" as const);
    }
  };
  return bindSessionCapabilities(gameSession, {
    snapshot,
    readProgress: progress.read,
    subscribeProgress: progress.subscribe,
    trackProgress: (retry) => {
      const deactivate = progress.activate(retry);
      const cancel = subscribeSaveCancellation(() => progress.cancel(), gameSession);
      return registerSessionCleanup(gameSession, () => {
        cancel();
        deactivate();
      });
    },
    checkpoint,
    retryProgress: () => {
      if (progress.read().kind === "idle" && getSaveWriteFailure(gameSession)) {
        markSessionProgress(gameSession, true);
        progress.complete(progress.token(readSessionRevision(gameSession)), "failed");
      }
      if (progress.active) progress.retryNow();
      else if (progress.read().kind === "failed") void checkpoint();
    },
    afterProgressSaved: (run) => progress.afterSaved(run),
    restore: (save: UnstampedSaveData, options?: SessionPersistenceRestoreOptions) => {
      progress.cancel();
      hydrateAlchemyPersistenceFields(save, gameSession);
      if (options?.preserveActiveRunIfInitialized && readRunInitialized(gameSession)) {
        return false;
      }
      restoreRun(save.activeRun, save.talentXP, save.unlockedTalents, gameSession, {
        abandonIncompatibleBattle: options?.restoreActions?.includes("abandon-active-run") ?? false,
      });
      return true;
    },
    configure: (backend: SaveBackend) => {
      progress.cancel();
      configureSaveBackend(backend, gameSession);
    },
    configurePlatform: () => configureAlchemySaveBackend(gameSession),
    load: () => loadAlchemySaveState(gameSession),
    write: (save: UnstampedSaveData) => write(save),
    writeOnExit: (save: UnstampedSaveData) => write(save, true),
    waitForWrites: () => waitForPendingSaveWrites(gameSession),
    clear: (mode: "default" | "localWipe" = "default") => {
      progress.cancel();
      return clearAlchemySaveData(mode, gameSession);
    },
    routeToRecovery: () => routeWritesToRecovery(gameSession),
    setWritesDisabled: (disabled: boolean) => {
      if (disabled) progress.cancel();
      setWritesDisabled(disabled, gameSession);
    },
    resetForTests: () => {
      progress.cancel();
      return resetStorageIoForTests(gameSession);
    },
    subscribe: (listener: () => void) => subscribeAlchemyPersistence(listener, gameSession),
    subscribeCancellation: (listener: () => void) => subscribeSaveCancellation(listener, gameSession),
    readFailure: () => getSaveWriteFailure(gameSession),
    subscribeFailure: (listener: () => void) => subscribeSaveWriteFailure(listener, gameSession),
  });
}
