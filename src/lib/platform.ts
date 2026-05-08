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
};
