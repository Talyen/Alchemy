import type { GameSession } from "../stores/game-session-types";
import { resolveActiveRunForSave, restoreRun } from "../stores/run-lifecycle";
import { readRunInitialized } from "../stores/run-reads";
import { bindSessionCapabilities } from "../stores/session-capabilities";
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
  return bindSessionCapabilities(gameSession, {
    snapshot: () => snapshotSessionSave(gameSession),
    restore: (save: UnstampedSaveData, options?: SessionPersistenceRestoreOptions) => {
      hydrateAlchemyPersistenceFields(save, gameSession);
      if (options?.preserveActiveRunIfInitialized && readRunInitialized(gameSession)) {
        return false;
      }
      restoreRun(save.activeRun, save.talentXP, save.unlockedTalents, gameSession, {
        abandonIncompatibleBattle: options?.restoreActions?.includes("abandon-active-run") ?? false,
      });
      return true;
    },
    configure: (backend: SaveBackend) => configureSaveBackend(backend, gameSession),
    configurePlatform: () => configureAlchemySaveBackend(gameSession),
    load: () => loadAlchemySaveState(gameSession),
    write: (save: UnstampedSaveData) => saveAlchemySaveData(save, gameSession),
    writeOnExit: (save: UnstampedSaveData) => saveAlchemySaveDataForExit(save, gameSession),
    waitForWrites: () => waitForPendingSaveWrites(gameSession),
    clear: (mode: "default" | "localWipe" = "default") => clearAlchemySaveData(mode, gameSession),
    routeToRecovery: () => routeWritesToRecovery(gameSession),
    setWritesDisabled: (disabled: boolean) => setWritesDisabled(disabled, gameSession),
    resetForTests: () => resetStorageIoForTests(gameSession),
    subscribe: (listener: () => void) => subscribeAlchemyPersistence(listener, gameSession),
    subscribeCancellation: (listener: () => void) => subscribeSaveCancellation(listener, gameSession),
    readFailure: () => getSaveWriteFailure(gameSession),
    subscribeFailure: (listener: () => void) => subscribeSaveWriteFailure(listener, gameSession),
  });
}
