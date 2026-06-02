// Platform bridge for capabilities that differ between browser and packaged
// desktop builds. Game code imports this instead of reaching into Electron.

const DESKTOP_SAVE_FILENAME = "save.json";

export type StorageReadResult = { ok: true; data: string | null } | { ok: false; error: unknown };
export type StorageWriteResult = { ok: true } | { ok: false; error: unknown };

function getDesktopApi(): NonNullable<Window["alchemyDesktop"]> | null {
  return window.alchemyDesktop ?? null;
}

export const platform = {
  isDesktop: Boolean(window.alchemyDesktop?.isDesktop),
  canQuit: Boolean(window.alchemyDesktop?.isDesktop),

  // Desktop display modes require native window control; browser builds cannot
  // reliably switch the outer OS window between windowed and borderless modes.
  setDisplayMode(mode: "windowed" | "borderless-fullscreen" | "fullscreen") {
    return window.alchemyDesktop?.setDisplayMode(mode) ?? Promise.resolve();
  },

  // Lets the desktop shell close the native app while browser builds simply do
  // nothing because pages cannot reliably close themselves.
  quit() {
    window.alchemyDesktop?.quit();
  },

  // Steamworks API integration with safe fallbacks for web/DRM-free
  steam: {
    isInitialized: false,
    playerName: null as string | null,
    async init() {
      if (window.alchemyDesktop?.steamGetName) {
        try {
          const name = await window.alchemyDesktop.steamGetName();
          if (name) {
            this.playerName = name;
            this.isInitialized = true;
            platform.cloud.isAvailable = true;
            console.log(`Steam initialized. Player: ${name}`);
          }
        } catch (err) {
          console.warn("Failed to retrieve Steam player name:", err);
        }
      }
    },
    async setRichPresence(key: string, value: string): Promise<boolean> {
      if (window.alchemyDesktop?.steamSetRichPresence) {
        return window.alchemyDesktop.steamSetRichPresence(key, value);
      }
      return false;
    },
  },

  // Persisted save I/O: localStorage on web; desktop file + optional Steam Cloud.
  storage: {
    async readLocal(key: string): Promise<StorageReadResult> {
      const desktop = getDesktopApi();
      if (desktop?.isDesktop) {
        try {
          return { ok: true, data: await desktop.loadSave() };
        } catch (error) {
          return { ok: false, error };
        }
      }
      try {
        return { ok: true, data: window.localStorage.getItem(key) };
      } catch (error) {
        return { ok: false, error };
      }
    },

    async writeLocal(key: string, value: string): Promise<StorageWriteResult> {
      const desktop = getDesktopApi();
      if (desktop?.isDesktop) {
        try {
          if (platform.cloud.isAvailable) {
            const cloudOk = await platform.cloud.write(DESKTOP_SAVE_FILENAME, value);
            if (!cloudOk) {
              console.warn("Steam Cloud write failed, save may not sync");
            }
          }
          const ok = await desktop.writeSave(value);
          if (ok) return { ok: true };
          return { ok: false, error: new Error("Failed to write desktop save file") };
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

    async removeLocal(key: string): Promise<StorageWriteResult> {
      const desktop = getDesktopApi();
      if (desktop?.isDesktop) {
        try {
          if (platform.cloud.isAvailable) {
            const cloudOk = await platform.cloud.delete(DESKTOP_SAVE_FILENAME);
            if (!cloudOk) {
              console.warn("Steam Cloud delete failed, save may remain in cloud");
            }
          }
          const ok = await desktop.clearSave();
          if (ok) return { ok: true };
          return { ok: false, error: new Error("Failed to clear desktop save file") };
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

    async readCloudFallback(): Promise<string | null> {
      if (!platform.cloud.isAvailable) return null;
      try {
        return await platform.cloud.read(DESKTOP_SAVE_FILENAME);
      } catch {
        return null;
      }
    },
  },

  // Steam Cloud save/load via the Steamworks API. Falls back to the local
  // filesystem when Steam is unavailable (DRM-free builds).
  cloud: {
    isAvailable: false,

    async read(_filename: string): Promise<string | null> {
      if (window.alchemyDesktop?.steamCloudRead) {
        try {
          return await window.alchemyDesktop.steamCloudRead();
        } catch {
          return null;
        }
      }
      return null;
    },

    async write(_filename: string, data: string): Promise<boolean> {
      if (window.alchemyDesktop?.steamCloudWrite) {
        try {
          return await window.alchemyDesktop.steamCloudWrite(data);
        } catch {
          return false;
        }
      }
      return false;
    },

    async delete(_filename: string): Promise<boolean> {
      if (window.alchemyDesktop?.steamCloudDelete) {
        try {
          return await window.alchemyDesktop.steamCloudDelete();
        } catch {
          return false;
        }
      }
      return false;
    },
  },
};
