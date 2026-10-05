import { createPlatformSaveBackend, type SaveBackend } from "@/lib/platform-save-backend";
import { isClientContext } from "@/lib/storage-environment";
import { logStorageFailure } from "@/lib/storage-logging";
import { createDefaultSaveData } from "./defaults";
import type { SaveLoadState } from "./save-candidates";
import { SaveStorage } from "./save-storage";
import type { SaveWriteOutcome } from "./save-write-queue";
import type { UnstampedSaveData } from "./types";

export function createSaveIo(
  backend?: SaveBackend,
  now: () => number = () => Date.now(),
  allowPlatformStorage = false,
) {
  const storage = new SaveStorage(backend ?? createPlatformSaveBackend(), now);
  let backendConfigured = backend !== undefined;
  let saveWriteFailed = false;
  const saveWriteListeners = new Set<() => void>();
  function getSaveWriteFailure(): boolean {
    return saveWriteFailed;
  }
  function subscribeSaveWriteFailure(listener: () => void): () => void {
    saveWriteListeners.add(listener);
    return () => {
      saveWriteListeners.delete(listener);
    };
  }
  function reportSaveWriteOutcome(outcome: SaveWriteOutcome): SaveWriteOutcome {
    if (outcome !== "skipped" && saveWriteFailed !== (outcome === "failed")) {
      saveWriteFailed = outcome === "failed";
      for (const listener of saveWriteListeners) {
        try {
          listener();
        } catch (error) {
          logStorageFailure("Save status update failed", error);
        }
      }
    }
    return outcome;
  }

  function isStorageAvailable(): boolean {
    return backendConfigured || (allowPlatformStorage && isClientContext());
  }

  function configureSaveBackend(backend: SaveBackend): void {
    storage.configureBackend(backend);
    backendConfigured = true;
  }

  function setWritesDisabled(disabled: boolean): void {
    storage.setWritesDisabled(disabled);
  }

  function routeWritesToRecovery(): void {
    storage.routeWritesToRecovery();
  }

  function subscribeSaveCancellation(listener: () => void): () => void {
    return storage.subscribeCancellation(listener);
  }

  function waitForPendingSaveWrites(): Promise<void> {
    return storage.waitForPendingWrites();
  }

  async function loadAlchemySaveState(): Promise<SaveLoadState> {
    if (isStorageAvailable()) return storage.load();
    storage.setWritesDisabled(false);
    return { data: createDefaultSaveData(), status: { kind: "ok" } };
  }

  async function saveAlchemySaveData(data: UnstampedSaveData): Promise<SaveWriteOutcome> {
    return reportSaveWriteOutcome(isStorageAvailable() ? await storage.save(data) : "skipped");
  }

  async function saveAlchemySaveDataForExit(data: UnstampedSaveData): Promise<SaveWriteOutcome> {
    return reportSaveWriteOutcome(isStorageAvailable() ? await storage.saveForExit(data) : "skipped");
  }

  async function clearAlchemySaveData(mode: "default" | "localWipe" = "default"): Promise<boolean> {
    const cleared = isStorageAvailable() ? await storage.clear(mode) : true;
    if (cleared) reportSaveWriteOutcome("saved");
    return cleared;
  }

  async function resetStorageIoForTests(): Promise<void> {
    await storage.resetForTests();
    storage.configureBackend(createPlatformSaveBackend());
    backendConfigured = false;
    reportSaveWriteOutcome("saved");
  }

  return {
    getSaveWriteFailure,
    subscribeSaveWriteFailure,
    configureSaveBackend,
    setWritesDisabled,
    routeWritesToRecovery,
    subscribeSaveCancellation,
    waitForPendingSaveWrites,
    loadAlchemySaveState,
    saveAlchemySaveData,
    saveAlchemySaveDataForExit,
    clearAlchemySaveData,
    resetStorageIoForTests,
  };
}
