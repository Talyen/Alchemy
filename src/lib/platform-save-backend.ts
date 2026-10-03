import { getDesktopApi, type DemoImportSource } from "./desktop-api";
import { logStorageFailure } from "./storage-logging";
import { tryLocalStorageGetItem, tryLocalStorageRemoveItem, tryLocalStorageSetItem } from "./storage-environment";
import { SAVE_KEY, SAVE_RECOVERY_KEY } from "./game-constants";

type SaveBackendReadResult =
  | { ok: true; candidates: string[]; localReadFailed?: boolean }
  | { ok: false; error: unknown };
type SaveBackendWriteResult = { ok: true } | { ok: false; error: unknown };

export interface SaveBackend {
  readDemoImportSource?: () => Promise<DemoImportSource>;
  completeDemoInitialization?: () => Promise<boolean>;
  readCandidates(key: string): Promise<SaveBackendReadResult>;
  write(key: string, value: string): Promise<SaveBackendWriteResult>;
  writeSync(key: string, value: string): SaveBackendWriteResult | null;
  clear(key: string, options?: SaveBackendClearOptions): Promise<SaveBackendWriteResult>;
}

interface PlatformSaveBackendOptions {
  cloudSyncEnabled?: boolean;
}

interface SaveBackendClearOptions {
  forceLocalWipe?: boolean;
}

type DesktopApi = NonNullable<ReturnType<typeof getDesktopApi>>;

async function withDesktopSaveApi<T extends SaveBackendReadResult | SaveBackendWriteResult>(
  operation: (desktop: DesktopApi) => Promise<T>,
): Promise<T | { ok: false; error: unknown }> {
  const desktop = getDesktopApi();
  if (desktop?.isDesktop !== true) {
    return { ok: false, error: new Error("Desktop save API is unavailable") };
  }
  try {
    return await operation(desktop);
  } catch (error) {
    return { ok: false, error };
  }
}

async function bestEffortCloudWrite(
  operation: () => Promise<boolean | undefined>,
  failureMessage: string,
): Promise<void> {
  try {
    const succeeded = (await operation()) ?? false;
    if (!succeeded) logStorageFailure(failureMessage);
  } catch (error) {
    logStorageFailure(failureMessage, error);
  }
}

async function clearDesktop(
  desktop: DesktopApi,
  cloudSyncEnabled: boolean,
  forceLocalWipe: boolean,
): Promise<SaveBackendWriteResult> {
  if (!forceLocalWipe) {
    if (desktop.completeDemoInitialization && !(await desktop.completeDemoInitialization())) {
      return { ok: false, error: new Error("Could not preserve demo initialization before clearing progress") };
    }
    if (cloudSyncEnabled) {
      const cloudCleared = (await desktop.steamCloudDelete?.()) ?? false;
      const recoveryCloudCleared = (await desktop.steamCloudDelete?.("recovery")) ?? false;
      if (!cloudCleared || !recoveryCloudCleared) {
        return { ok: false, error: new Error("Failed to clear Steam Cloud save") };
      }
    }
  }
  // Native clearSave preserves the receipt. A forced wipe clears local progress
  // first; ordinary clearing requires successful Cloud deletion before this point.
  const localCleared = await desktop.clearSave();
  if (!localCleared) {
    return { ok: false, error: new Error("Failed to clear desktop save file") };
  }
  if (forceLocalWipe && cloudSyncEnabled) {
    await bestEffortCloudWrite(
      () => desktop.steamCloudDelete?.(),
      "Steam Cloud delete failed after local wipe; next save will overwrite the mirror",
    );
    await bestEffortCloudWrite(
      () => desktop.steamCloudDelete?.("recovery"),
      "Steam Cloud recovery delete failed after local wipe; next save will overwrite the mirror",
    );
  }
  return { ok: true };
}

async function readDesktopCandidates(desktop: DesktopApi, recovery: boolean): Promise<SaveBackendReadResult> {
  let localCandidates: string[] = [];
  let localReadFailed: boolean;
  let localReadError: unknown;
  try {
    const result = await desktop.readSaveSlot(recovery ? "recovery" : undefined);
    localCandidates = result.candidates;
    localReadFailed = result.localReadFailed;
    if (localReadFailed) localReadError = new Error("Local save candidates could not be read completely");
  } catch (error) {
    localReadFailed = true;
    localReadError = error;
    logStorageFailure("Desktop save candidates could not be listed", error);
  }

  let cloudCandidate: string | null = null;
  try {
    cloudCandidate = (await desktop.steamCloudRead?.(recovery ? "recovery" : undefined)) ?? null;
  } catch (error) {
    logStorageFailure("Steam Cloud read failed", error);
  }

  if (localReadFailed && !cloudCandidate && localCandidates.length === 0) return { ok: false, error: localReadError };
  return {
    ok: true,
    // Dedup keeps the local ring ahead of the Cloud mirror in first-seen order.
    candidates: [...new Set(cloudCandidate ? [...localCandidates, cloudCandidate] : localCandidates)],
    ...(localReadFailed ? { localReadFailed: true } : {}),
  };
}

async function writeDesktopSave(
  desktop: DesktopApi,
  key: string,
  value: string,
  cloudSyncEnabled: boolean,
): Promise<SaveBackendWriteResult> {
  const slot = key === SAVE_RECOVERY_KEY ? "recovery" : undefined;
  const localWritten = await desktop.writeSave(value, slot);
  // Recovery may still be mirrored after a local failure; the primary slot
  // must remain local-first. Neither Cloud result changes local write success.
  if (cloudSyncEnabled && (localWritten || slot === "recovery")) {
    await bestEffortCloudWrite(
      () => desktop.steamCloudWrite?.(value, slot),
      localWritten
        ? "Steam Cloud write failed, save may not sync"
        : "Recovery save could not be mirrored to Steam Cloud",
    );
  }
  return localWritten ? { ok: true } : { ok: false, error: new Error("Failed to write desktop save file") };
}

async function readDemoImportSource(): Promise<DemoImportSource> {
  return (
    getDesktopApi()?.readDemoImportSource?.() ?? {
      initialized: true,
      fullSaveExists: false,
      readFailed: false,
      candidates: [],
    }
  );
}

async function completeDemoInitialization(): Promise<boolean> {
  return (await getDesktopApi()?.completeDemoInitialization?.()) ?? false;
}

export function createBrowserSaveBackend(): SaveBackend {
  return {
    readCandidates(key) {
      const stored = tryLocalStorageGetItem(key);
      return Promise.resolve(stored.ok ? { ok: true, candidates: stored.value ? [stored.value] : [] } : stored);
    },

    write: (key, value) => Promise.resolve(tryLocalStorageSetItem(key, value)),

    writeSync: tryLocalStorageSetItem,

    clear(key) {
      const removed = tryLocalStorageRemoveItem(key);
      return Promise.resolve(removed.ok && key === SAVE_KEY ? tryLocalStorageRemoveItem(SAVE_RECOVERY_KEY) : removed);
    },
  };
}

export function createDesktopSaveBackend({ cloudSyncEnabled = false }: PlatformSaveBackendOptions = {}): SaveBackend {
  return {
    readDemoImportSource,
    completeDemoInitialization,
    readCandidates: (key) => withDesktopSaveApi((desktop) => readDesktopCandidates(desktop, key === SAVE_RECOVERY_KEY)),
    write: (key, value) => withDesktopSaveApi((desktop) => writeDesktopSave(desktop, key, value, cloudSyncEnabled)),

    // Desktop persistence is async IPC: exit flushes go through the queue.
    writeSync() {
      return null;
    },

    clear: (_key, options) =>
      withDesktopSaveApi((desktop) => clearDesktop(desktop, cloudSyncEnabled, options?.forceLocalWipe === true)),
  };
}

export function createPlatformSaveBackend({ cloudSyncEnabled = false }: PlatformSaveBackendOptions = {}): SaveBackend {
  const browser = createBrowserSaveBackend();
  const desktop = createDesktopSaveBackend({ cloudSyncEnabled });
  // Dispatched per call (not at creation): tests and bootstrap swap the
  // environment between backend creation and use.
  const active = () => (getDesktopApi()?.isDesktop === true ? desktop : browser);
  return {
    readDemoImportSource,
    completeDemoInitialization,
    readCandidates: (key) => active().readCandidates(key),
    write: (key, value) => active().write(key, value),
    writeSync: (key, value) => active().writeSync(key, value),
    clear: (key, options) => active().clear(key, options),
  };
}
