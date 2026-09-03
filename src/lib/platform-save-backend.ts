import { getDesktopApi, isDesktopApiAvailable } from "./desktop-api";

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

async function clearDesktopForced(desktop: DesktopApi, cloudSyncEnabled: boolean): Promise<SaveBackendWriteResult> {
  const localCleared = await desktop.clearSave();
  if (!localCleared) {
    return { ok: false, error: new Error("Failed to clear desktop save file") };
  }
  if (cloudSyncEnabled) {
    try {
      const cloudCleared = (await desktop.steamCloudDelete?.()) ?? false;
      if (!cloudCleared)
        console.warn("Steam Cloud delete failed after local wipe; next save will overwrite the mirror");
    } catch (error) {
      console.warn("Steam Cloud delete failed after local wipe; next save will overwrite the mirror", error);
    }
  }
  return { ok: true };
}

async function readDesktopCandidates(): Promise<string[]> {
  const desktop = getDesktopApi();
  if (!desktop) return [];

  let localCandidates: string[] = [];
  try {
    localCandidates = await desktop.listSaveCandidates();
  } catch (error) {
    console.warn("Desktop save candidates could not be listed", error);
  }

  let cloudCandidate: string | null = null;
  try {
    cloudCandidate = (await desktop.steamCloudRead?.()) ?? null;
  } catch (error) {
    console.warn("Steam Cloud read failed", error);
  }

  return uniqueCandidates(cloudCandidate ? [...localCandidates, cloudCandidate] : localCandidates);
}

export function createPlatformSaveBackend({ cloudSyncEnabled = false }: PlatformSaveBackendOptions = {}): SaveBackend {
  return {
    async readCandidates(key) {
      if (isDesktopApiAvailable()) {
        return { ok: true, candidates: await readDesktopCandidates() };
      }

      try {
        const local = window.localStorage.getItem(key);
        return { ok: true, candidates: local ? [local] : [] };
      } catch (error) {
        return { ok: false, error };
      }
    },

    async write(key, value) {
      if (isDesktopApiAvailable()) {
        const desktop = getDesktopApi();
        if (!desktop) return { ok: false, error: new Error("Desktop API unavailable") };
        try {
          const localWritten = await desktop.writeSave(value);
          if (!localWritten) {
            return { ok: false, error: new Error("Failed to write desktop save file") };
          }
          if (cloudSyncEnabled) {
            try {
              const cloudWritten = (await desktop.steamCloudWrite?.(value)) ?? false;
              if (!cloudWritten) console.warn("Steam Cloud write failed, save may not sync");
            } catch (error) {
              console.warn("Steam Cloud write failed, save may not sync", error);
            }
          }
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
      if (isDesktopApiAvailable()) return null;

      try {
        window.localStorage.setItem(key, value);
        return { ok: true };
      } catch (error) {
        return { ok: false, error };
      }
    },

    async clear(key, options?: SaveBackendClearOptions) {
      if (isDesktopApiAvailable()) {
        const desktop = getDesktopApi();
        if (!desktop) return { ok: false, error: new Error("Desktop API unavailable") };
        try {
          if (options?.forceLocalWipe) {
            return await clearDesktopForced(desktop, cloudSyncEnabled);
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
