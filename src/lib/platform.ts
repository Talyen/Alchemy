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
            console.log(`Steam initialized. Player: ${name}`);
          }
        } catch (err) {
          console.warn("Failed to retrieve Steam player name:", err);
        }
      }
    },
    async unlockAchievement(id: string): Promise<boolean> {
      if (window.alchemyDesktop?.steamUnlockAchievement) {
        return window.alchemyDesktop.steamUnlockAchievement(id);
      }
      return false;
    },
    async setRichPresence(key: string, value: string): Promise<boolean> {
      if (window.alchemyDesktop?.steamSetRichPresence) {
        return window.alchemyDesktop.steamSetRichPresence(key, value);
      }
      return false;
    },
  },
};
