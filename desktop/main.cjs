// Electron main process for the Windows desktop build. It owns the native
// security boundary and loads either loopback Vite or the packaged renderer.
const { app, BrowserWindow, ipcMain, Menu, net, protocol, session } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const {
  APP_ORIGIN,
  APP_PROTOCOL,
  MAX_SAVE_PAYLOAD_BYTES,
  PACKAGED_CSP,
  assertAuthorizedIpcEvent,
  isAllowedRendererUrl,
  isDisplayMode,
  isRichPresenceKey,
  isRichPresenceValue,
  isSavePayload,
  parseDevServerUrl,
  resolveAppAssetPath,
} = require("./security.cjs");
const { flushSentryTestEvent, initializeMainSentry } = require("./sentry.cjs");
const { armSentryCrashTest, resolveSentryCrashTestMode } = require("./sentry-crash-test.cjs");

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_PROTOCOL,
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
]);

const CRASH_REPORTING_ENABLED = initializeMainSentry(app);
const SENTRY_CRASH_TEST_MODE = resolveSentryCrashTestMode(app, CRASH_REPORTING_ENABLED);

const DEV_SERVER_URL = process.env.ELECTRON_RENDERER_URL ?? "http://127.0.0.1:5173";
const USE_PACKAGED_RENDERER = app.isPackaged || process.env.ELECTRON_FORCE_PACKAGED_RENDERER === "1";
const RENDERER_POLICY = { packaged: USE_PACKAGED_RENDERER, devServerUrl: DEV_SERVER_URL };
const RENDERER_ROOT = path.join(__dirname, "..", "dist");
const WINDOWED_SIZE = { width: 1280, height: 720 };
const SAVE_FILE_PATH = path.join(app.getPath("userData"), "save.json");
const SAVE_TMP_PATH = path.join(app.getPath("userData"), "save.json.tmp");
const SAVE_BAK_PATHS = [1, 2, 3].map((i) => path.join(app.getPath("userData"), `save.json.bak.${i}`));
let mainWindow = null;
let steamClient = null;

if (!USE_PACKAGED_RENDERER) parseDevServerUrl(DEV_SERVER_URL);

function initializeSteamworks() {
  const steamAppId = Number.parseInt(process.env.STEAM_APP_ID ?? "480", 10);
  try {
    const steamworks = require("steamworks.js");
    steamworks.electronEnableSteamOverlay();
    steamClient = steamworks.init(steamAppId);
    console.log("Steamworks initialized successfully.");
  } catch (error) {
    console.warn("Failed to initialize Steamworks (Steam might not be running):", error.message);
  }
}

function setRendererFullscreen(window, enabled) {
  return window.webContents
    .executeJavaScript(
      enabled
        ? "document.fullscreenElement || document.documentElement.requestFullscreen?.()"
        : "document.fullscreenElement ? document.exitFullscreen?.() : undefined",
      true,
    )
    .catch(() => undefined);
}

function applyDisplayMode(window, mode) {
  if (mode === "windowed") {
    setRendererFullscreen(window, false);
    window.setFullScreen(false);
    window.setResizable(true);
    window.setSize(WINDOWED_SIZE.width, WINDOWED_SIZE.height);
    window.center();
    return;
  }
  window.setResizable(true);
  window.setFullScreen(true);
  setRendererFullscreen(window, mode === "fullscreen");
}

function authorize(event) {
  assertAuthorizedIpcEvent(event, mainWindow, RENDERER_POLICY);
}

function handleAuthorized(channel, handler) {
  ipcMain.handle(channel, (event, ...args) => {
    authorize(event);
    return handler(...args);
  });
}

function registerIpcHandlers() {
  handleAuthorized("alchemy:quit", () => app.quit());
  handleAuthorized("alchemy:set-display-mode", (mode) => {
    if (isDisplayMode(mode) && mainWindow) applyDisplayMode(mainWindow, mode);
  });

  handleAuthorized("alchemy:list-save-candidates", async () => {
    const candidates = [];
    for (const filePath of [SAVE_FILE_PATH, ...SAVE_BAK_PATHS]) {
      try {
        const data = await fs.promises.readFile(filePath, "utf8");
        if (isSavePayload(data)) candidates.push(data);
      } catch (error) {
        if (error?.code === "ENOENT") continue;
        console.error(`Error reading save candidate ${filePath}:`, error);
      }
    }
    return candidates;
  });

  handleAuthorized("alchemy:write-save", async (data) => {
    if (!isSavePayload(data)) return false;
    try {
      await fs.promises.mkdir(path.dirname(SAVE_FILE_PATH), { recursive: true });
      const handle = await fs.promises.open(SAVE_TMP_PATH, "w");
      try {
        await handle.writeFile(data, "utf8");
        await handle.datasync();
      } finally {
        await handle.close();
      }
      for (let index = SAVE_BAK_PATHS.length - 1; index >= 0; index -= 1) {
        const to = SAVE_BAK_PATHS[index];
        const from = index === 0 ? SAVE_FILE_PATH : SAVE_BAK_PATHS[index - 1];
        try {
          await fs.promises.access(from, fs.constants.F_OK);
        } catch (error) {
          if (error?.code === "ENOENT") continue;
          throw error;
        }
        if (index === SAVE_BAK_PATHS.length - 1) {
          await fs.promises.unlink(to).catch((error) => {
            if (error?.code !== "ENOENT") throw error;
          });
        }
        await fs.promises.rename(from, to);
      }
      await fs.promises.rename(SAVE_TMP_PATH, SAVE_FILE_PATH);
      return true;
    } catch (error) {
      await fs.promises.unlink(SAVE_TMP_PATH).catch((cleanupError) => {
        if (cleanupError?.code !== "ENOENT") console.error("Error cleaning up temp save file:", cleanupError);
      });
      console.error("Error writing save file:", error);
      return false;
    }
  });

  handleAuthorized("alchemy:clear-save", async () => {
    try {
      await fs.promises.unlink(SAVE_FILE_PATH);
      return true;
    } catch (error) {
      if (error?.code === "ENOENT") return true;
      console.error("Error clearing save file:", error);
      return false;
    }
  });

  handleAuthorized("alchemy:steam-cloud-read", async () => {
    if (!steamClient) return null;
    try {
      if (!steamClient.cloud.fileExists("save.json")) return null;
      const buffer = await steamClient.cloud.readFile("save.json");
      if (buffer && buffer.length > MAX_SAVE_PAYLOAD_BYTES) {
        console.error(`Steam Cloud save exceeds ${MAX_SAVE_PAYLOAD_BYTES} bytes; ignoring.`);
        return null;
      }
      return buffer ? buffer.toString("utf8") : null;
    } catch (error) {
      console.error("Error reading Steam Cloud save:", error);
      return null;
    }
  });

  handleAuthorized("alchemy:steam-cloud-write", async (data) => {
    if (!steamClient || !isSavePayload(data)) return false;
    try {
      return steamClient.cloud.writeFile("save.json", data);
    } catch (error) {
      console.error("Error writing Steam Cloud save:", error);
      return false;
    }
  });

  handleAuthorized("alchemy:steam-cloud-delete", async () => {
    if (!steamClient) return false;
    try {
      return steamClient.cloud.fileExists("save.json") ? steamClient.cloud.deleteFile("save.json") : true;
    } catch (error) {
      console.error("Error deleting Steam Cloud save:", error);
      return false;
    }
  });

  handleAuthorized("alchemy:steam-get-name", () => {
    try {
      return steamClient?.localplayer.getName() ?? null;
    } catch (error) {
      console.error("Error getting Steam name:", error);
      return null;
    }
  });

  handleAuthorized("alchemy:steam-set-rich-presence", (key, value) => {
    if (!isRichPresenceKey(key) || !isRichPresenceValue(value) || !steamClient) return false;
    try {
      return steamClient.localplayer.setRichPresence(key, value);
    } catch (error) {
      console.error("Error setting Steam rich presence:", error);
      return false;
    }
  });
}

async function registerRendererProtocol() {
  if (!USE_PACKAGED_RENDERER) return;
  await protocol.handle(APP_PROTOCOL, async (request) => {
    const assetPath = resolveAppAssetPath(RENDERER_ROOT, request.url);
    if (!assetPath) return new Response("Not found", { status: 404 });
    try {
      const stats = await fs.promises.stat(assetPath);
      if (!stats.isFile()) return new Response("Not found", { status: 404 });
      return net.fetch(pathToFileURL(assetPath).toString());
    } catch {
      return new Response("Not found", { status: 404 });
    }
  });
}

function applySessionSecurity() {
  const activeSession = session.defaultSession;
  activeSession.setPermissionCheckHandler(() => false);
  activeSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  activeSession.on("will-download", (event) => event.preventDefault());
  activeSession.webRequest.onHeadersReceived((details, callback) => {
    if (!USE_PACKAGED_RENDERER || !details.url.startsWith(`${APP_ORIGIN}/`)) {
      callback({ responseHeaders: details.responseHeaders });
      return;
    }
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [PACKAGED_CSP],
      },
    });
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: WINDOWED_SIZE.width,
    height: WINDOWED_SIZE.height,
    minWidth: 960,
    minHeight: 540,
    fullscreen: true,
    backgroundColor: "#120d0a",
    show: false,
    webPreferences: {
      allowRunningInsecureContent: false,
      contextIsolation: true,
      devTools: !USE_PACKAGED_RENDERER,
      experimentalFeatures: false,
      nodeIntegration: false,
      additionalArguments: CRASH_REPORTING_ENABLED ? ["--alchemy-crash-reporting-enabled"] : [],
      preload: path.join(__dirname, "preload.cjs"),
      sandbox: true,
      webSecurity: true,
      webviewTag: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!isAllowedRendererUrl(url, RENDERER_POLICY)) event.preventDefault();
  });
  mainWindow.webContents.on("will-frame-navigate", (event, details) => {
    if (!details.isMainFrame || !isAllowedRendererUrl(details.url, RENDERER_POLICY)) event.preventDefault();
  });
  mainWindow.webContents.on("will-redirect", (event) => event.preventDefault());
  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  Menu.setApplicationMenu(null);
  armSentryCrashTest(mainWindow, SENTRY_CRASH_TEST_MODE, setTimeout, async (mode) => {
    const result = await flushSentryTestEvent(mode);
    const statusDirectory = process.env.ALCHEMY_SENTRY_TEST_STATUS_DIR;
    if (statusDirectory) {
      const statusPath = path.join(statusDirectory, `alchemy-sentry-${mode}.json`);
      fs.writeFileSync(statusPath, JSON.stringify(result), { encoding: "utf8", mode: 0o600 });
    }
  });
  void mainWindow.loadURL(USE_PACKAGED_RENDERER ? `${APP_ORIGIN}/` : DEV_SERVER_URL);
}

app.whenReady().then(async () => {
  await registerRendererProtocol();
  applySessionSecurity();
  registerIpcHandlers();
  initializeSteamworks();

  if (steamClient?.callback) {
    setInterval(() => {
      try {
        steamClient.callback.runCallbacks();
      } catch (error) {
        console.error("Error running Steam callbacks:", error);
      }
    }, 50);
  }

  createMainWindow();
  app.on("activate", () => {
    if (!mainWindow) createMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
