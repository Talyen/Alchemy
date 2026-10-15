// Electron main process for the Windows desktop build. It owns the native
// security boundary and loads either loopback Vite or the packaged renderer.
const { app, BrowserWindow, ipcMain, Menu, net, protocol, session, shell } = require("electron");
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
const { initializeMainSentry } = require("./sentry.cjs");
const { resolveEdition, editionPolicy } = require("../game-edition.mjs");
const { createDesktopSaveStorage } = require("./save-storage.cjs");
const { createSteamCloudStorage } = require("./steam-cloud-storage.cjs");
const { createDemoProgressBridge, stampSaveOwner } = require("./demo-progress.cjs");
const TEST_PROFILE_ISOLATED =
  app.commandLine.hasSwitch("user-data-dir") || (!app.isPackaged && Boolean(process.env.ALCHEMY_ELECTRON_TEST_PROFILE));
// Background automation is restricted to isolated development profiles.
const BACKGROUND_AUTOMATION =
  !app.isPackaged && TEST_PROFILE_ISOLATED && process.env.ALCHEMY_ELECTRON_BACKGROUND === "1";
const { openWishlist } = require("./wishlist.cjs");
const { registerOverlayPause } = require("./steam-overlay.cjs");
const { resolveApplicationMenuTemplate } = require("./application-menu.cjs");
const metadata = require(path.join(app.getAppPath(), "package.json"));
const EDITION = resolveEdition(app.isPackaged ? metadata.gameEdition : process.env.ALCHEMY_EDITION);
const EDITION_POLICY = editionPolicy(EDITION);
if (EDITION === "demo" && !TEST_PROFILE_ISOLATED) {
  app.setName("Alchemy Demo");
  app.setPath("userData", path.join(app.getPath("appData"), "Alchemy Demo"));
}

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

const DEV_SERVER_URL = process.env.ELECTRON_RENDERER_URL ?? `http://127.0.0.1:${process.env.ALCHEMY_DEV_PORT ?? 5173}`;
const USE_PACKAGED_RENDERER = app.isPackaged || process.env.ELECTRON_FORCE_PACKAGED_RENDERER === "1";
const RENDERER_POLICY = { packaged: USE_PACKAGED_RENDERER, devServerUrl: DEV_SERVER_URL };
const RENDERER_ROOT = path.join(__dirname, "..", EDITION_POLICY.rendererDirectory);
const WINDOWED_SIZE = { width: 1280, height: 720 };
const SAVE_SLOTS = Object.fromEntries(
  ["save.json", "save-recovery.json"].map((name, index) => [
    index === 0 ? "primary" : "recovery",
    {
      name: EDITION_POLICY.cloudFiles[index],
      file: path.join(app.getPath("userData"), name),
      tmp: path.join(app.getPath("userData"), `${name}.tmp`),
      backups: [1, 2, 3].map((i) => path.join(app.getPath("userData"), `${name}.bak.${i}`)),
    },
  ]),
);
let mainWindow = null;
let steamClient = null;
const demoProgress = createDemoProgressBridge({
  directory: app.getPath("userData"),
  demoDirectory: path.join(app.getPath("appData"), "Alchemy Demo"),
  getSteam: () => steamClient,
  isSavePayload,
  edition: EDITION,
});

const saveStorage = createDesktopSaveStorage({
  slots: SAVE_SLOTS,
  demoProgress,
  isSavePayload,
  stampOwner: (data) => stampSaveOwner(data, steamClient),
});

const steamCloudStorage = createSteamCloudStorage({
  resolveSlot: resolveSaveSlot,
  getSteam: () => steamClient,
  isSavePayload,
  stampOwner: stampSaveOwner,
  maxPayloadBytes: MAX_SAVE_PAYLOAD_BYTES,
});

if (!USE_PACKAGED_RENDERER) parseDevServerUrl(DEV_SERVER_URL);

function readPackagedSteamAppId() {
  try {
    const metadata = require(path.join(app.getAppPath(), "package.json"));
    const raw = metadata?.steamAppId;
    if (raw == null || raw === "") return null;
    const parsed = Number.parseInt(String(raw), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
}

function resolveSteamAppId() {
  // Packaged CI builds bake steamAppId via electron-builder extraMetadata.
  // Dev falls back to STEAM_APP_ID (from sync-steam-appid / env) then Spacewar 480.
  return (
    readPackagedSteamAppId() ??
    Number.parseInt((EDITION === "demo" ? process.env.STEAM_DEMO_APP_ID : process.env.STEAM_APP_ID) ?? "480", 10)
  );
}

function initializeSteamworks() {
  // Automated Electron/package checks must not read or mirror a live Steam profile.
  if (TEST_PROFILE_ISOLATED) return;
  const steamAppId = resolveSteamAppId();
  if (app.isPackaged) {
    const rendererIdentity = JSON.parse(fs.readFileSync(path.join(RENDERER_ROOT, "edition.json"), "utf8"));
    if (rendererIdentity.edition !== EDITION) throw new Error("Package and renderer editions differ");
  }
  try {
    const steamworks = require("steamworks.js");
    steamworks.electronEnableSteamOverlay();
    steamClient = steamworks.init(steamAppId);
    const overlayPause = registerOverlayPause({
      client: steamClient,
      steamCallbacks: steamworks.SteamCallback,
      pause: () => mainWindow?.webContents.send("alchemy:external-focus-lost"),
    });
    if (overlayPause) {
      app.once("before-quit", () => overlayPause.disconnect());
    } else {
      console.warn("Steam overlay activation callbacks are unavailable; custom shortcuts and Deck require validation.");
    }
    console.log(`Steamworks initialized successfully (App ID ${steamAppId}).`);
  } catch (error) {
    console.warn("Failed to initialize Steamworks (Steam might not be running):", error);
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
  if (BACKGROUND_AUTOMATION) return;
  if (process.platform === "darwin") {
    // Native macOS/HTML fullscreen reserves the notch strip. Simple fullscreen
    // uses the entire display and stays on the current desktop instead.
    window.setSimpleFullScreen(mode !== "windowed");
    if (mode === "windowed") {
      window.setResizable(true);
      window.setMinimizable(true);
      window.setSize(WINDOWED_SIZE.width, WINDOWED_SIZE.height);
      window.center();
    }
    return;
  }
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

function resolveSaveSlot(slot) {
  if (slot === undefined) return SAVE_SLOTS.primary;
  if (slot === "recovery") return SAVE_SLOTS.recovery;
  throw new Error("Invalid save slot");
}

function registerIpcHandlers() {
  handleAuthorized("alchemy:demo-import-source", saveStorage.readDemoImportSource);
  handleAuthorized("alchemy:demo-initialization", saveStorage.completeDemoInitialization);
  handleAuthorized("alchemy:wishlist", () =>
    openWishlist({
      appId: app.isPackaged ? metadata.fullGameSteamAppId : process.env.STEAM_APP_ID,
      client: steamClient,
      openExternal: (url) => shell.openExternal(url),
      pause: () => mainWindow?.webContents.send("alchemy:external-focus-lost"),
    }),
  );
  handleAuthorized("alchemy:quit", () => app.quit());
  handleAuthorized("alchemy:set-display-mode", (mode) => {
    if (isDisplayMode(mode) && mainWindow) applyDisplayMode(mainWindow, mode);
  });

  handleAuthorized("alchemy:list-save-candidates", async (slot) => {
    const result = await saveStorage.read(slot);
    if (result.localReadFailed) throw new Error("Save candidates could not be read completely");
    return result.candidates;
  });
  handleAuthorized("alchemy:read-save-slot", saveStorage.read);

  handleAuthorized("alchemy:write-save", saveStorage.write);
  handleAuthorized("alchemy:clear-save", saveStorage.clear);

  handleAuthorized("alchemy:steam-cloud-read", steamCloudStorage.read);
  handleAuthorized("alchemy:steam-cloud-write", steamCloudStorage.write);
  handleAuthorized("alchemy:steam-cloud-delete", steamCloudStorage.remove);

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
    icon: path.join(__dirname, "icons", "icon.png"),
    width: WINDOWED_SIZE.width,
    height: WINDOWED_SIZE.height,
    minWidth: 960,
    minHeight: 540,
    fullscreen: !BACKGROUND_AUTOMATION && process.platform !== "darwin",
    fullscreenable: true,
    simpleFullscreen: !BACKGROUND_AUTOMATION && process.platform === "darwin",
    backgroundColor: "#120d0a",
    show: false,
    webPreferences: {
      backgroundThrottling: !BACKGROUND_AUTOMATION,
      offscreen: BACKGROUND_AUTOMATION && process.env.ALCHEMY_ELECTRON_OFFSCREEN === "1",
      allowRunningInsecureContent: false,
      contextIsolation: true,
      devTools: !USE_PACKAGED_RENDERER,
      experimentalFeatures: false,
      nodeIntegration: false,
      additionalArguments: [
        `--alchemy-edition=${EDITION}`,
        ...(CRASH_REPORTING_ENABLED ? ["--alchemy-crash-reporting-enabled"] : []),
      ],
      preload: path.join(__dirname, "preload.cjs"),
      sandbox: true,
      webSecurity: true,
      webviewTag: false,
    },
  });

  if (!BACKGROUND_AUTOMATION && process.platform === "darwin") mainWindow.setSimpleFullScreen(true);

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!isAllowedRendererUrl(url, RENDERER_POLICY)) event.preventDefault();
  });
  mainWindow.webContents.on("will-frame-navigate", (event, details) => {
    if (!details.isMainFrame || !isAllowedRendererUrl(details.url, RENDERER_POLICY)) event.preventDefault();
  });
  mainWindow.webContents.on("will-redirect", (event) => event.preventDefault());
  mainWindow.once("ready-to-show", () => {
    if (!BACKGROUND_AUTOMATION) mainWindow?.show();
  });
  mainWindow.webContents.on("before-input-event", (_event, input) => {
    if (input.type === "keyDown" && input.key === "Tab" && input.shift && !input.alt && !input.control && !input.meta) {
      mainWindow?.webContents.send("alchemy:external-focus-lost");
    }
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  const menuTemplate = resolveApplicationMenuTemplate({
    platform: process.platform,
    isBackground: BACKGROUND_AUTOMATION,
  });
  Menu.setApplicationMenu(menuTemplate ? Menu.buildFromTemplate(menuTemplate) : null);
  void mainWindow.loadURL(USE_PACKAGED_RENDERER ? `${APP_ORIGIN}/` : DEV_SERVER_URL);
}

app.whenReady().then(async () => {
  if (BACKGROUND_AUTOMATION && process.platform === "darwin") app.setActivationPolicy("prohibited");
  await registerRendererProtocol();
  applySessionSecurity();
  registerIpcHandlers();
  initializeSteamworks();

  // steamworks.js owns the callback pump started by init().
  createMainWindow();
  app.on("activate", () => {
    if (BACKGROUND_AUTOMATION) return;
    if (!mainWindow) createMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
