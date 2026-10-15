import { createNotificationChannel } from "../stores/notification-channel";
import { createPlatformSaveBackend, type SaveBackend } from "@/lib/platform-save-backend";
import { isClientContext } from "@/lib/storage-environment";
import { logStorageFailure } from "@/lib/storage-logging";
import { createDefaultSaveData } from "./defaults";
import type { SaveLoadState } from "./save-candidates";
import { SaveStorage } from "./save-storage";
import type { SaveStorageEvent, SaveWriteOutcome } from "./save-operation-queue";
import type { UnstampedSaveData } from "./types";

export function createSaveIo(
  backend?: SaveBackend,
  now: () => number = () => Date.now(),
  allowPlatformStorage = false,
) {
  const storage = new SaveStorage(backend ?? createPlatformSaveBackend(), now);
  let backendConfigured = backend !== undefined;
  let saveWriteFailed = false;
  const pendingWriteResults = new Set<Promise<SaveWriteOutcome>>();
  const notifications = createNotificationChannel<[]>((error) => {
    logStorageFailure("Save status update failed", error);
  });
  const events = createNotificationChannel<[SaveStorageEvent]>((error) => {
    logStorageFailure("Save storage listener threw", error);
  });
  storage.subscribeEvents(events.publish);
  function getSaveWriteFailure(): boolean {
    return saveWriteFailed;
  }
  const subscribeSaveWriteFailure = notifications.subscribe;
  function reportSaveWriteOutcome(outcome: SaveWriteOutcome): SaveWriteOutcome {
    if ((outcome === "saved" || outcome === "failed") && saveWriteFailed !== (outcome === "failed")) {
      saveWriteFailed = outcome === "failed";
      notifications.publish();
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

  const subscribeSaveEvents = events.subscribe;

  async function waitForPendingSaveWrites(): Promise<void> {
    // Drain the published outcomes as well as backend work. Transport completion
    // alone does not mean failure status and progress receipts have settled.
    do {
      await Promise.all([...pendingWriteResults]);
      await storage.waitForPendingWrites();
    } while (pendingWriteResults.size > 0);
  }

  async function loadAlchemySaveState(): Promise<SaveLoadState> {
    if (isStorageAvailable()) return storage.load();
    storage.setWritesDisabled(false);
    return { data: createDefaultSaveData(), status: { kind: "ok" } };
  }

  function writeSnapshot(
    data: UnstampedSaveData,
    exit: boolean,
    complete: (outcome: SaveWriteOutcome) => SaveWriteOutcome = (outcome) => outcome,
    validate: () => SaveWriteOutcome | undefined = () => undefined,
  ): Promise<SaveWriteOutcome> {
    const result = (async () => {
      const outcome = isStorageAvailable()
        ? await (exit ? storage.saveForExit(data, validate) : storage.save(data, validate))
        : "skipped";
      return complete(reportSaveWriteOutcome(validate() ?? outcome));
    })();
    pendingWriteResults.add(result);
    const release = () => {
      pendingWriteResults.delete(result);
    };
    void result.then(release, release);
    return result;
  }

  function saveAlchemySaveData(
    data: UnstampedSaveData,
    complete?: (outcome: SaveWriteOutcome) => SaveWriteOutcome,
    validate?: () => SaveWriteOutcome | undefined,
  ) {
    return writeSnapshot(data, false, complete, validate);
  }

  function saveAlchemySaveDataForExit(
    data: UnstampedSaveData,
    complete?: (outcome: SaveWriteOutcome) => SaveWriteOutcome,
    validate?: () => SaveWriteOutcome | undefined,
  ) {
    return writeSnapshot(data, true, complete, validate);
  }

  async function clearAlchemySaveData(mode: "default" | "localWipe" = "default"): Promise<boolean> {
    let cleared: boolean;
    if (isStorageAvailable()) cleared = await storage.clear(mode);
    else {
      events.publish("clear-started");
      events.publish("cleared");
      cleared = true;
    }
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
    subscribeSaveEvents,
    isClearing: () => storage.isClearing(),
    waitForPendingSaveWrites,
    loadAlchemySaveState,
    saveAlchemySaveData,
    saveAlchemySaveDataForExit,
    clearAlchemySaveData,
    resetStorageIoForTests,
  };
}
