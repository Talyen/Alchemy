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
  return isStorageAvailable() ? storage.save(data) : "skipped";
}

export async function saveAlchemySaveDataForExit(data: UnstampedSaveData): Promise<SaveWriteOutcome> {
  return isStorageAvailable() ? storage.saveForExit(data) : "skipped";
}

export async function clearAlchemySaveData(
  mode: "default" | "localWipe" | "wipeForReload" = "default",
): Promise<boolean> {
  return isStorageAvailable() ? storage.clear(mode) : true;
}

export async function resetStorageIoForTests(): Promise<void> {
  await storage.resetForTests();
  storage.configureBackend(createPlatformSaveBackend());
  backendConfigured = false;
}
