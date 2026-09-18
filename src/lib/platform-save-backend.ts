import { getDesktopApi } from "./desktop-api";
import { logStorageFailure } from "./storage-logging";
import { tryLocalStorageGetItem, tryLocalStorageRemoveItem, tryLocalStorageSetItem } from "./storage-environment";

type SaveBackendReadResult = { ok: true; candidates: string[] } | { ok: false; error: unknown };
type SaveBackendWriteResult = { ok: true } | { ok: false; error: unknown };

export interface SaveBackend {
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

// Local-first ordering invariant: local ring candidates precede the Cloud
// mirror, so dedup must preserve first-seen order. Kept module-private next
// to its sole caller to prevent reuse that would bypass that ordering.
function uniqueCandidates(candidates: string[]): string[] {
  return Array.from(new Set(candidates));
}

type DesktopApi = NonNullable<ReturnType<typeof getDesktopApi>>;

function desktopUnavailable(): { ok: false; error: unknown } {
  return { ok: false, error: new Error("Desktop save API is unavailable") };
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
  if (forceLocalWipe) {
    const localCleared = await desktop.clearSave();
    if (!localCleared) {
      return { ok: false, error: new Error("Failed to clear desktop save file") };
    }
    if (cloudSyncEnabled) {
      await bestEffortCloudWrite(
        () => desktop.steamCloudDelete?.(),
        "Steam Cloud delete failed after local wipe; next save will overwrite the mirror",
      );
    }
    return { ok: true };
  }
  if (cloudSyncEnabled) {
    const cloudCleared = (await desktop.steamCloudDelete?.()) ?? false;
    if (!cloudCleared) {
      return { ok: false, error: new Error("Failed to clear Steam Cloud save") };
    }
  }
  const localCleared = await desktop.clearSave();
  if (!localCleared) {
    return { ok: false, error: new Error("Failed to clear desktop save file") };
  }
  return { ok: true };
}

async function readDesktopCandidates(desktop: DesktopApi): Promise<string[]> {
  let localCandidates: string[] = [];
  try {
    localCandidates = await desktop.listSaveCandidates();
  } catch (error) {
    logStorageFailure("Desktop save candidates could not be listed", error);
  }

  let cloudCandidate: string | null = null;
  try {
    cloudCandidate = (await desktop.steamCloudRead?.()) ?? null;
  } catch (error) {
    logStorageFailure("Steam Cloud read failed", error);
  }

  return uniqueCandidates(cloudCandidate ? [...localCandidates, cloudCandidate] : localCandidates);
}

export function createBrowserSaveBackend(): SaveBackend {
  return {
    readCandidates(key) {
      const stored = tryLocalStorageGetItem(key);
      if (!stored.ok) return Promise.resolve(stored);
      return Promise.resolve({ ok: true, candidates: stored.value ? [stored.value] : [] });
    },

    write(key, value) {
      const stored = tryLocalStorageSetItem(key, value);
      if (!stored.ok) return Promise.resolve(stored);
      return Promise.resolve({ ok: true });
    },

    writeSync(key, value) {
      const stored = tryLocalStorageSetItem(key, value);
      if (!stored.ok) return stored;
      return { ok: true };
    },

    clear(key) {
      const removed = tryLocalStorageRemoveItem(key);
      if (!removed.ok) return Promise.resolve(removed);
      return Promise.resolve({ ok: true });
    },
  };
}

export function createDesktopSaveBackend({ cloudSyncEnabled = false }: PlatformSaveBackendOptions = {}): SaveBackend {
  return {
    async readCandidates() {
      const desktop = getDesktopApi();
      if (desktop?.isDesktop !== true) return desktopUnavailable();
      return { ok: true, candidates: await readDesktopCandidates(desktop) };
    },

    async write(_key, value) {
      const desktop = getDesktopApi();
      if (desktop?.isDesktop !== true) return desktopUnavailable();
      try {
        const localWritten = await desktop.writeSave(value);
        if (!localWritten) {
          return { ok: false, error: new Error("Failed to write desktop save file") };
        }
        if (cloudSyncEnabled) {
          await bestEffortCloudWrite(
            () => desktop.steamCloudWrite?.(value),
            "Steam Cloud write failed, save may not sync",
          );
        }
        return { ok: true };
      } catch (error) {
        return { ok: false, error };
      }
    },

    // Desktop persistence is async IPC: exit flushes go through the queue.
    writeSync() {
      return null;
    },

    async clear(_key, options?: SaveBackendClearOptions) {
      const desktop = getDesktopApi();
      if (desktop?.isDesktop !== true) return desktopUnavailable();
      try {
        return await clearDesktop(desktop, cloudSyncEnabled, options?.forceLocalWipe === true);
      } catch (error) {
        return { ok: false, error };
      }
    },
  };
}

export function createPlatformSaveBackend({ cloudSyncEnabled = false }: PlatformSaveBackendOptions = {}): SaveBackend {
  const browser = createBrowserSaveBackend();
  const desktop = createDesktopSaveBackend({ cloudSyncEnabled });
  // Dispatched per call (not at creation): tests and bootstrap swap the
  // environment between backend creation and use.
  const active = () => (getDesktopApi()?.isDesktop === true ? desktop : browser);
  return {
    readCandidates: (key) => active().readCandidates(key),
    write: (key, value) => active().write(key, value),
    writeSync: (key, value) => active().writeSync(key, value),
    clear: (key, options) => active().clear(key, options),
  };
}
