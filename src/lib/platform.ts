// Platform bridge for capabilities that differ between browser and packaged
// desktop builds. Game code imports this instead of reaching into Electron.
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
