// Safe renderer bridge for desktop-only capabilities. The React app only sees
// this narrow API instead of direct Electron or Node access.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("alchemyDesktop", {
  isDesktop: true,
  crashReportingEnabled: process.argv.includes("--alchemy-crash-reporting-enabled"),
  setDisplayMode: (mode) => ipcRenderer.invoke("alchemy:set-display-mode", mode),
  quit: () => ipcRenderer.invoke("alchemy:quit"),
  listSaveCandidates: () => ipcRenderer.invoke("alchemy:list-save-candidates"),
  writeSave: (data) => ipcRenderer.invoke("alchemy:write-save", data),
  clearSave: () => ipcRenderer.invoke("alchemy:clear-save"),
  steamGetName: () => ipcRenderer.invoke("alchemy:steam-get-name"),
  steamSetRichPresence: (key, val) => ipcRenderer.invoke("alchemy:steam-set-rich-presence", key, val),
  steamCloudRead: () => {
    if (typeof document !== "undefined") {
      const mockEl = document.getElementById("__steamCloudReadMock");
      if (mockEl) {
        return Promise.resolve(mockEl.getAttribute("data-payload") || null);
      }
    }
    return ipcRenderer.invoke("alchemy:steam-cloud-read");
  },
  steamCloudWrite: (data) => ipcRenderer.invoke("alchemy:steam-cloud-write", data),
  steamCloudDelete: () => ipcRenderer.invoke("alchemy:steam-cloud-delete"),
});
