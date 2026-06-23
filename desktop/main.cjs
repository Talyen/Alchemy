// Electron main process for the Windows desktop build. It owns the native window
// and loads either the Vite dev server or the packaged renderer files.
const { app, BrowserWindow, ipcMain, Menu } = require("electron");
const path = require("node:path");
const fs = require("node:fs");

// Enable Steam overlay in Electron if steamworks.js is available
const STEAM_APP_ID = Number.parseInt(process.env.STEAM_APP_ID ?? "480", 10);
let steamClient = null;
try {
  const steamworks = require("steamworks.js");
  steamworks.electronEnableSteamOverlay();
  steamClient = steamworks.init(STEAM_APP_ID);
  console.log("Steamworks initialized successfully. Player name:", steamClient.localplayer.getName());
} catch (error) {
  console.warn("Failed to initialize Steamworks (Steam might not be running):", error.message);
}

const DEV_SERVER_URL = process.env.ELECTRON_RENDERER_URL ?? "http://127.0.0.1:5173";
const WINDOWED_SIZE = { width: 1280, height: 720 };
const SAVE_FILE_PATH = path.join(app.getPath("userData"), "save.json");
const SAVE_TMP_PATH = path.join(app.getPath("userData"), "save.json.tmp");
const SAVE_BAK_PATHS = [1, 2, 3].map((i) => path.join(app.getPath("userData"), `save.json.bak.${i}`));

function isDisplayMode(value) {
  return value === "windowed" || value === "borderless-fullscreen" || value === "fullscreen";
}

const MAX_SAVE_PAYLOAD_BYTES = 4 * 1024 * 1024;
const MAX_RICH_PRESENCE_KEY_LEN = 64;
const MAX_RICH_PRESENCE_VALUE_LEN = 256;

function assertSavePayload(data) {
  return typeof data === "string" && Buffer.byteLength(data, "utf8") <= MAX_SAVE_PAYLOAD_BYTES;
}

function assertRichPresenceKey(key) {
  return typeof key === "string" && key.length > 0 && key.length <= MAX_RICH_PRESENCE_KEY_LEN;
}

function assertRichPresenceValue(value) {
  return typeof value === "string" && value.length <= MAX_RICH_PRESENCE_VALUE_LEN;
}

function getMainWindow() {
  return BrowserWindow.getAllWindows()[0];
}

function setRendererFullscreen(mainWindow, enabled) {
  return mainWindow.webContents
    .executeJavaScript(
      enabled
        ? "document.fullscreenElement || document.documentElement.requestFullscreen?.()"
        : "document.fullscreenElement ? document.exitFullscreen?.() : undefined",
      true,
    )
    .catch(() => undefined);
}

function applyDisplayMode(mainWindow, mode) {
  if (mode === "windowed") {
    setRendererFullscreen(mainWindow, false);
    mainWindow.setFullScreen(false);
    mainWindow.setResizable(true);
    mainWindow.setSize(WINDOWED_SIZE.width, WINDOWED_SIZE.height);
    mainWindow.center();
    return;
  }

  mainWindow.setResizable(true);
  mainWindow.setFullScreen(true);
  setRendererFullscreen(mainWindow, mode === "fullscreen");
}

function createMainWindow() {
  const mainWindow = new BrowserWindow({
    width: WINDOWED_SIZE.width,
    height: WINDOWED_SIZE.height,
    minWidth: 960,
    minHeight: 540,
    fullscreen: true,
    backgroundColor: "#120d0a",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());
  Menu.setApplicationMenu(null);

  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  } else {
    mainWindow.loadURL(DEV_SERVER_URL);
  }
}

app.whenReady().then(() => {
  ipcMain.handle("alchemy:quit", () => app.quit());
  ipcMain.handle("alchemy:set-display-mode", (_event, mode) => {
    if (!isDisplayMode(mode)) {
      return;
    }

    const mainWindow = getMainWindow();
    if (mainWindow) {
      applyDisplayMode(mainWindow, mode);
    }
  });

  // Asynchronous Save/Load handlers

  // Returns every save candidate the renderer can walk, in preference order
  // (local, bak.1, bak.2, bak.3). Each string is a raw file payload that the
  // renderer parses and validates; this handler only does cheap I/O and size
  // filtering.
  ipcMain.handle("alchemy:list-save-candidates", async () => {
    const candidates = [];
    const localPaths = [SAVE_FILE_PATH, ...SAVE_BAK_PATHS];
    for (const filePath of localPaths) {
      try {
        const data = await fs.promises.readFile(filePath, "utf8");
        if (typeof data === "string" && Buffer.byteLength(data, "utf8") <= MAX_SAVE_PAYLOAD_BYTES) {
          candidates.push(data);
        }
      } catch (err) {
        if (err && err.code === "ENOENT") continue;
        console.error(`Error reading save candidate ${filePath}:`, err);
      }
    }
    return candidates;
  });

  ipcMain.handle("alchemy:write-save", async (_event, data) => {
    if (!assertSavePayload(data)) {
      return false;
    }
    try {
      const dir = path.dirname(SAVE_FILE_PATH);
      if (!fs.existsSync(dir)) {
        await fs.promises.mkdir(dir, { recursive: true });
      }

      // 1. Write to save.json.tmp in the same directory (required for Windows
      //    MoveFileEx replace semantics to be atomic across volumes).
      const handle = await fs.promises.open(SAVE_TMP_PATH, "w");
      try {
        await handle.writeFile(data, "utf8");
        await handle.fdatasync();
      } finally {
        await handle.close();
      }

      // 2. Rotate backups: save.json -> bak.1 -> bak.2 -> bak.3 (delete oldest).
      //    Iterate from highest index down so we never clobber a slot we still need.
      for (let i = SAVE_BAK_PATHS.length - 1; i >= 0; i -= 1) {
        const to = SAVE_BAK_PATHS[i];
        const from = i === 0 ? SAVE_FILE_PATH : SAVE_BAK_PATHS[i - 1];
        try {
          await fs.promises.access(from, fs.constants.F_OK);
        } catch (err) {
          if (err && err.code === "ENOENT") continue;
          throw err;
        }
        if (i === SAVE_BAK_PATHS.length - 1) {
          try {
            await fs.promises.unlink(to);
          } catch (err) {
            if (!err || err.code !== "ENOENT") throw err;
          }
        }
        await fs.promises.rename(from, to, { overwrite: true });
      }

      // 3. Final atomic swap.
      await fs.promises.rename(SAVE_TMP_PATH, SAVE_FILE_PATH, { overwrite: true });
      return true;
    } catch (error) {
      // Best-effort cleanup of partial temp file.
      try {
        await fs.promises.unlink(SAVE_TMP_PATH);
      } catch (err) {
        if (!err || err.code !== "ENOENT") {
          console.error("Error cleaning up temp save file:", err);
        }
      }
      console.error("Error writing save file:", error);
      return false;
    }
  });

  ipcMain.handle("alchemy:clear-save", async () => {
    try {
      await fs.promises.unlink(SAVE_FILE_PATH);
      return true;
    } catch (error) {
      if (error.code === "ENOENT") {
        return true;
      }
      console.error("Error clearing save file:", error);
      return false;
    }
  });

  // Steam Cloud Save Handlers
  ipcMain.handle("alchemy:steam-cloud-read", async () => {
    if (!steamClient) return null;
    try {
      if (steamClient.cloud.fileExists("save.json")) {
        const buf = await steamClient.cloud.readFile("save.json");
        // Reject oversized cloud blobs before they hit the renderer.
        if (buf && buf.length > MAX_SAVE_PAYLOAD_BYTES) {
          console.error(`Steam Cloud save exceeds ${MAX_SAVE_PAYLOAD_BYTES} bytes (got ${buf.length}); ignoring.`);
          return null;
        }
        return buf ? buf.toString("utf8") : null;
      }
    } catch (err) {
      console.error("Error reading Steam Cloud save:", err);
    }
    return null;
  });

  ipcMain.handle("alchemy:steam-cloud-write", async (_event, data) => {
    if (!steamClient) return false;
    if (!assertSavePayload(data)) {
      return false;
    }
    try {
      return steamClient.cloud.writeFile("save.json", data);
    } catch (err) {
      console.error("Error writing Steam Cloud save:", err);
      return false;
    }
  });

  ipcMain.handle("alchemy:steam-cloud-delete", async () => {
    if (!steamClient) return false;
    try {
      if (steamClient.cloud.fileExists("save.json")) {
        return steamClient.cloud.deleteFile("save.json");
      }
      return true;
    } catch (err) {
      console.error("Error deleting Steam Cloud save:", err);
      return false;
    }
  });

  // Steam API Handlers
  ipcMain.handle("alchemy:steam-get-name", () => {
    if (steamClient) {
      try {
        return steamClient.localplayer.getName();
      } catch (err) {
        console.error("Error getting Steam name:", err);
      }
    }
    return null;
  });

  ipcMain.handle("alchemy:steam-set-rich-presence", (_event, key, value) => {
    if (!assertRichPresenceKey(key) || !assertRichPresenceValue(value)) {
      return false;
    }
    if (steamClient) {
      try {
        console.log(`Setting Steam rich presence: ${key} = ${value}`);
        return steamClient.localplayer.setRichPresence(key, value);
      } catch (err) {
        console.error(`Error setting rich presence ${key}:`, err);
      }
    }
    return false;
  });

  // Keep Steam callbacks firing if steamworks client exists
  if (steamClient && steamClient.callback) {
    setInterval(() => {
      try {
        steamClient.callback.runCallbacks();
      } catch (err) {
        console.error("Error running Steam callbacks:", err);
      }
    }, 50);
  }

  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
