// Safe renderer bridge for desktop-only capabilities. The React app only sees
// this narrow API instead of direct Electron or Node access.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("alchemyDesktop", {
  isDesktop: true,
  setDisplayMode: (mode) => ipcRenderer.invoke("alchemy:set-display-mode", mode),
  quit: () => ipcRenderer.invoke("alchemy:quit"),
  loadSave: () => ipcRenderer.invoke("alchemy:load-save"),
  writeSave: (data) => ipcRenderer.invoke("alchemy:write-save", data),
  clearSave: () => ipcRenderer.invoke("alchemy:clear-save"),
  steamGetName: () => ipcRenderer.invoke("alchemy:steam-get-name"),
  steamUnlockAchievement: (id) => ipcRenderer.invoke("alchemy:steam-unlock-achievement", id),
  steamSetRichPresence: (key, val) => ipcRenderer.invoke("alchemy:steam-set-rich-presence", key, val),
});
