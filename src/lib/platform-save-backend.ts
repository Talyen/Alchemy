import { getDesktopApi } from "./desktop-api";
import { logStorageFailure } from "./storage-logging";

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

export function uniqueCandidates(candidates: string[]): string[] {
  return Array.from(new Set(candidates));
}

type DesktopApi = NonNullable<ReturnType<typeof getDesktopApi>>;

async function mirrorCloudWriteBestEffort(desktop: DesktopApi, value: string): Promise<void> {
  try {
    const cloudWritten = (await desktop.steamCloudWrite?.(value)) ?? false;
    if (!cloudWritten) logStorageFailure("Steam Cloud write failed, save may not sync");
  } catch (error) {
    logStorageFailure("Steam Cloud write failed, save may not sync", error);
  }
}

async function deleteCloudBestEffortAfterLocalWipe(desktop: DesktopApi): Promise<void> {
  try {
    const cloudCleared = (await desktop.steamCloudDelete?.()) ?? false;
    if (!cloudCleared)
      logStorageFailure("Steam Cloud delete failed after local wipe; next save will overwrite the mirror");
  } catch (error) {
    logStorageFailure("Steam Cloud delete failed after local wipe; next save will overwrite the mirror", error);
  }
}

async function clearDesktopForced(desktop: DesktopApi, cloudSyncEnabled: boolean): Promise<SaveBackendWriteResult> {
  const localCleared = await desktop.clearSave();
  if (!localCleared) {
    return { ok: false, error: new Error("Failed to clear desktop save file") };
  }
  if (cloudSyncEnabled) await deleteCloudBestEffortAfterLocalWipe(desktop);
  return { ok: true };
}

async function clearDesktopNormal(desktop: DesktopApi, cloudSyncEnabled: boolean): Promise<SaveBackendWriteResult> {
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

export function createPlatformSaveBackend({ cloudSyncEnabled = false }: PlatformSaveBackendOptions = {}): SaveBackend {
  return {
    async readCandidates(key) {
      const desktop = getDesktopApi();
      if (desktop?.isDesktop === true) {
        return { ok: true, candidates: await readDesktopCandidates(desktop) };
      }

      try {
        const local = window.localStorage.getItem(key);
        return { ok: true, candidates: local ? [local] : [] };
      } catch (error) {
        return { ok: false, error };
      }
    },

    async write(key, value) {
      const desktop = getDesktopApi();
      if (desktop?.isDesktop === true) {
        try {
          const localWritten = await desktop.writeSave(value);
          if (!localWritten) {
            return { ok: false, error: new Error("Failed to write desktop save file") };
          }
          if (cloudSyncEnabled) await mirrorCloudWriteBestEffort(desktop, value);
          return { ok: true };
        } catch (error) {
          return { ok: false, error };
        }
      }

      try {
        window.localStorage.setItem(key, value);
        return { ok: true };
      } catch (error) {
        return { ok: false, error };
      }
    },

    writeSync(key, value) {
      if (getDesktopApi()?.isDesktop === true) return null;

      try {
        window.localStorage.setItem(key, value);
        return { ok: true };
      } catch (error) {
        return { ok: false, error };
      }
    },

    async clear(key, options?: SaveBackendClearOptions) {
      const desktop = getDesktopApi();
      if (desktop?.isDesktop === true) {
        try {
          if (options?.forceLocalWipe) return await clearDesktopForced(desktop, cloudSyncEnabled);
          return await clearDesktopNormal(desktop, cloudSyncEnabled);
        } catch (error) {
          return { ok: false, error };
        }
      }

      try {
        window.localStorage.removeItem(key);
        return { ok: true };
      } catch (error) {
        return { ok: false, error };
      }
    },
  };
}
