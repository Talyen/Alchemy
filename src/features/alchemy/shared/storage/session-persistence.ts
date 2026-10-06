import type { GameSession } from "../stores/game-session-types";
import { resolveActiveRunForSave, restoreRun } from "../stores/run-lifecycle";
import { readHasActiveRun } from "../stores/run-reads";
import { bindSessionCapabilities } from "../stores/session-capabilities";
import {
  configureSaveBackend,
  loadAlchemySaveState,
  saveAlchemySaveData,
  saveAlchemySaveDataForExit,
  subscribeSaveCancellation,
  waitForPendingSaveWrites,
  getSaveWriteFailure,
  subscribeSaveWriteFailure,
} from "./io";
import {
  buildAlchemySaveDataFromStores,
  hydrateAlchemyPersistenceFields,
  subscribeAlchemyPersistence,
} from "./persistence";
import type { SaveBackend } from "@/lib/platform-save-backend";
import type { UnstampedSaveData } from "./types";

export function snapshotSessionSave(gameSession: GameSession) {
  return buildAlchemySaveDataFromStores(
    resolveActiveRunForSave(readHasActiveRun(gameSession), undefined, gameSession),
    gameSession,
  );
}

export function createSessionPersistence(gameSession: GameSession) {
  return bindSessionCapabilities(gameSession, {
    snapshot: () => snapshotSessionSave(gameSession),
    restore: (save: UnstampedSaveData) => {
      hydrateAlchemyPersistenceFields(save, gameSession);
      restoreRun(save.activeRun, save.talentXP, save.unlockedTalents, gameSession);
    },
    configure: (backend: SaveBackend) => configureSaveBackend(backend, gameSession),
    load: () => loadAlchemySaveState(gameSession),
    write: (save: UnstampedSaveData) => saveAlchemySaveData(save, gameSession),
    writeOnExit: (save: UnstampedSaveData) => saveAlchemySaveDataForExit(save, gameSession),
    waitForWrites: () => waitForPendingSaveWrites(gameSession),
    subscribe: (listener: () => void) => subscribeAlchemyPersistence(listener, gameSession),
    subscribeCancellation: (listener: () => void) => subscribeSaveCancellation(listener, gameSession),
    readFailure: () => getSaveWriteFailure(gameSession),
    subscribeFailure: (listener: () => void) => subscribeSaveWriteFailure(listener, gameSession),
  });
}
