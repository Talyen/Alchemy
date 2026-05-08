// Electron main process for the Windows desktop build. It owns the native window
// and loads either the Vite dev server or the packaged renderer files.
const { app, BrowserWindow, ipcMain, Menu } = require("electron");
const path = require("node:path");

const DEV_SERVER_URL = process.env.ELECTRON_RENDERER_URL ?? "http://127.0.0.1:5173";
const WINDOWED_SIZE = { width: 1280, height: 720 };

function isDisplayMode(value) {
  return value === "windowed" || value === "borderless-fullscreen" || value === "fullscreen";
}

function getMainWindow() {
  return BrowserWindow.getAllWindows()[0];
}

function setRendererFullscreen(mainWindow, enabled) {
  return mainWindow.webContents.executeJavaScript(
    enabled
      ? "document.fullscreenElement || document.documentElement.requestFullscreen?.()"
      : "document.fullscreenElement ? document.exitFullscreen?.() : undefined",
    true,
  ).catch(() => undefined);
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
