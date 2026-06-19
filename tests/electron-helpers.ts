import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type ElectronApplication, type Page, _electron as electron } from "playwright";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const previewPort = Number.parseInt(process.env.PLAYWRIGHT_ELECTRON_PREVIEW_PORT ?? "4175", 10);
const rendererUrl = `http://127.0.0.1:${previewPort}`;
const pathMarkerFile = path.join(projectRoot, "test-results", ".electron-executable-path");

function platformExecutableName(): string {
  switch (process.platform) {
    case "win32":
      return "electron.exe";
    case "darwin":
    case "mas":
      return "Electron.app/Contents/MacOS/Electron";
    default:
      return "electron";
  }
}

function getElectronExecutablePath(): string {
  if (fs.existsSync(pathMarkerFile)) {
    const fromMarker = fs.readFileSync(pathMarkerFile, "utf8").trim();
    if (fromMarker && fs.existsSync(fromMarker)) {
      return fromMarker;
    }
  }

  const electronRoot = path.join(projectRoot, "node_modules", "electron");
  const pathFile = path.join(electronRoot, "path.txt");
  const relativePath = fs.existsSync(pathFile) ? fs.readFileSync(pathFile, "utf8").trim() : platformExecutableName();

  const overrideDist = process.env.ELECTRON_OVERRIDE_DIST_PATH;
  const executablePath = overrideDist
    ? path.join(overrideDist, relativePath)
    : path.join(electronRoot, "dist", relativePath);

  if (!fs.existsSync(executablePath)) {
    throw new Error(
      `Electron executable missing at ${executablePath}. Run "npm run ensure:electron" before desktop smoke tests.`,
    );
  }

  return executablePath;
}

export async function launchElectronApp(): Promise<ElectronApplication> {
  const args = process.env.CI ? [".", "--no-sandbox", "--disable-gpu"] : ["."];

  return electron.launch({
    executablePath: getElectronExecutablePath(),
    args,
    cwd: projectRoot,
    env: {
      ...process.env,
      ELECTRON_RENDERER_URL: rendererUrl,
    },
  });
}

export async function getElectronMainWindow(app: ElectronApplication): Promise<Page> {
  const window = await app.firstWindow();
  await window.waitForLoadState("domcontentloaded");
  return window;
}
