import { logStorageFailure } from "@/lib/storage-logging";
import type { ProgressSaveState } from "./progress-completion";
import type { GameSession } from "../stores/game-session-types";
import { restoreSessionSave } from "../stores/run-lifecycle";
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
  subscribeSaveEvents,
  subscribeSaveWriteFailure,
  waitForPendingSaveWrites,
} from "./io";
import { buildAlchemySaveDataFromStores, subscribeAlchemyPersistence } from "./persistence";
import { configureAlchemySaveBackend } from "./bootstrap-save-state";
import type { SaveBackend } from "@/lib/platform-save-backend";
import type { SaveLoadState, SaveRestoreAction } from "./save-candidates";
import type { SaveStorageEvent, SaveWriteOutcome } from "./save-operation-queue";
import type { UnstampedSaveData } from "./types";
import { sessionRuntime } from "../stores/session-runtime";

export type PersistenceInterruption = SaveStorageEvent | "restored";

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
  readonly isClearing: () => boolean;
  readonly subscribeInterruption: (listener: (event: PersistenceInterruption) => void) => () => void;
  readonly readFailure: () => boolean;
  readonly subscribeFailure: (listener: () => void) => () => void;
}

export function snapshotSessionSave(gameSession: GameSession) {
  return buildAlchemySaveDataFromStores(gameSession);
}

export function createSessionPersistence(gameSession: GameSession): SessionPersistence {
  const progress = sessionProgressCompletion(gameSession);
  const snapshot = () => snapshotSessionSave(gameSession);
  const write = (save: UnstampedSaveData, exit = false) =>
    exit ? saveAlchemySaveDataForExit(save, gameSession) : saveAlchemySaveData(save, gameSession);
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
    subscribeProgress: (listener) => registerSessionCleanup(gameSession, progress.subscribe(listener)),
    trackProgress: (retry) => {
      return registerSessionCleanup(gameSession, progress.registerRetryDriver(retry));
    },
    checkpoint,
    retryProgress: () => {
      if (progress.read().kind === "idle" && getSaveWriteFailure(gameSession)) {
        markSessionProgress(gameSession, true);
        progress.complete(progress.token(readSessionRevision(gameSession)), "failed");
      }
      if (progress.hasRetryDriver) progress.retryNow();
      else if (progress.read().kind === "failed") void checkpoint();
    },
    afterProgressSaved: (run) => progress.afterSaved(run),
    restore: (save: UnstampedSaveData, options?: SessionPersistenceRestoreOptions) => {
      return restoreSessionSave(save, gameSession, {
        preserveActiveRunIfInitialized: options?.preserveActiveRunIfInitialized ?? false,
        abandonIncompatibleBattle: options?.restoreActions?.includes("abandon-active-run") ?? false,
      });
    },
    configure: (backend: SaveBackend) => {
      configureSaveBackend(backend, gameSession);
    },
    configurePlatform: () => configureAlchemySaveBackend(gameSession),
    load: () => loadAlchemySaveState(gameSession),
    write: (save: UnstampedSaveData) => write(save),
    writeOnExit: (save: UnstampedSaveData) => write(save, true),
    waitForWrites: () => waitForPendingSaveWrites(gameSession),
    clear: (mode: "default" | "localWipe" = "default") => {
      return clearAlchemySaveData(mode, gameSession);
    },
    routeToRecovery: () => routeWritesToRecovery(gameSession),
    setWritesDisabled: (disabled: boolean) => {
      setWritesDisabled(disabled, gameSession);
    },
    resetForTests: () => {
      return resetStorageIoForTests(gameSession);
    },
    subscribe: (listener: () => void) => subscribeAlchemyPersistence(listener, gameSession),
    isClearing: () => sessionRuntime(gameSession).io.isClearing(),
    subscribeInterruption: (listener: (event: PersistenceInterruption) => void) => {
      const cancelStorage = subscribeSaveEvents(listener, gameSession);
      const cancelRestore = progress.subscribeRestore(() => listener("restored"));
      return registerSessionCleanup(gameSession, () => {
        cancelStorage();
        cancelRestore();
      });
    },
    readFailure: () => getSaveWriteFailure(gameSession),
    subscribeFailure: (listener: () => void) => subscribeSaveWriteFailure(listener, gameSession),
  });
}
