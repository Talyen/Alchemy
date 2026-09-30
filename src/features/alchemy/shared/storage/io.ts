import { logStorageFailure } from "@/lib/storage-logging";
import { createPlatformSaveBackend, type SaveBackend } from "@/lib/platform-save-backend";
import { isClientContext } from "@/lib/storage-environment";
import { createDefaultSaveData } from "./defaults";
import { SaveStorage } from "./save-storage";
import type { SaveLoadState } from "./save-candidates";
import type { UnstampedSaveData } from "./types";
import type { SaveWriteOutcome } from "./save-write-queue";

export { serializeSaveSnapshot } from "./save-storage";

const storage = new SaveStorage(createPlatformSaveBackend());
let backendConfigured = false;
let saveWriteFailed = false;
const saveWriteListeners = new Set<() => void>();
export function getSaveWriteFailure(): boolean {
  return saveWriteFailed;
}
export function subscribeSaveWriteFailure(listener: () => void): () => void {
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
  return backendConfigured || isClientContext();
}

export function configureSaveBackend(backend: SaveBackend): void {
  storage.configureBackend(backend);
  backendConfigured = true;
}

export function setWritesDisabled(disabled: boolean): void {
  storage.setWritesDisabled(disabled);
}

export function routeWritesToRecovery(): void {
  storage.routeWritesToRecovery();
}

export function subscribeSaveCancellation(listener: () => void): () => void {
  return storage.subscribeCancellation(listener);
}

export function waitForPendingSaveWrites(): Promise<void> {
  return storage.waitForPendingWrites();
}

export async function loadAlchemySaveState(): Promise<SaveLoadState> {
  if (isStorageAvailable()) return storage.load();
  storage.setWritesDisabled(false);
  return { data: createDefaultSaveData(), status: { kind: "ok" } };
}

export async function saveAlchemySaveData(data: UnstampedSaveData): Promise<SaveWriteOutcome> {
  return reportSaveWriteOutcome(isStorageAvailable() ? await storage.save(data) : "skipped");
}

export async function saveAlchemySaveDataForExit(data: UnstampedSaveData): Promise<SaveWriteOutcome> {
  return reportSaveWriteOutcome(isStorageAvailable() ? await storage.saveForExit(data) : "skipped");
}

export async function clearAlchemySaveData(mode: "default" | "localWipe" = "default"): Promise<boolean> {
  const cleared = isStorageAvailable() ? await storage.clear(mode) : true;
  if (cleared) reportSaveWriteOutcome("saved");
  return cleared;
}

export async function resetStorageIoForTests(): Promise<void> {
  await storage.resetForTests();
  storage.configureBackend(createPlatformSaveBackend());
  backendConfigured = false;
  reportSaveWriteOutcome("saved");
}
