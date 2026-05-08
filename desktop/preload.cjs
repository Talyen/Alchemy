// Safe renderer bridge for desktop-only capabilities. The React app only sees
// this narrow API instead of direct Electron or Node access.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("alchemyDesktop", {
  isDesktop: true,
  setDisplayMode: (mode) => ipcRenderer.invoke("alchemy:set-display-mode", mode),
  quit: () => ipcRenderer.invoke("alchemy:quit"),
});
