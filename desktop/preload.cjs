// Safe renderer bridge for desktop-only capabilities. The React app only sees
// this narrow API instead of direct Electron or Node access.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("alchemyDesktop", {
  isDesktop: true,
  edition: process.argv.includes("--alchemy-edition=demo") ? "demo" : "full",
  openWishlist: () => ipcRenderer.invoke("alchemy:wishlist"),
  readDemoImportSource: () => ipcRenderer.invoke("alchemy:demo-import-source"),
  completeDemoInitialization: () => ipcRenderer.invoke("alchemy:demo-initialization"),
  onExternalFocusLost: (listener) => {
    const handler = () => listener();
    ipcRenderer.on("alchemy:external-focus-lost", handler);
    return () => ipcRenderer.removeListener("alchemy:external-focus-lost", handler);
  },
  crashReportingEnabled: process.argv.includes("--alchemy-crash-reporting-enabled"),
  setDisplayMode: (mode) => ipcRenderer.invoke("alchemy:set-display-mode", mode),
  quit: () => ipcRenderer.invoke("alchemy:quit"),
  listSaveCandidates: (slot) => ipcRenderer.invoke("alchemy:list-save-candidates", slot),
  readSaveSlot: (slot) => ipcRenderer.invoke("alchemy:read-save-slot", slot),
  writeSave: (data, slot) => ipcRenderer.invoke("alchemy:write-save", data, slot),
  clearSave: () => ipcRenderer.invoke("alchemy:clear-save"),
  steamGetGameLanguage: () => ipcRenderer.invoke("alchemy:steam-get-game-language"),
  steamIsCloudEnabled: () => ipcRenderer.invoke("alchemy:steam-is-cloud-enabled"),
  steamGetName: () => ipcRenderer.invoke("alchemy:steam-get-name"),
  steamSetRichPresence: (key, val) => ipcRenderer.invoke("alchemy:steam-set-rich-presence", key, val),
  steamCloudRead: (slot) => ipcRenderer.invoke("alchemy:steam-cloud-read", slot),
  steamCloudWrite: (data, slot) => ipcRenderer.invoke("alchemy:steam-cloud-write", data, slot),
  steamCloudDelete: (slot) => ipcRenderer.invoke("alchemy:steam-cloud-delete", slot),
});
