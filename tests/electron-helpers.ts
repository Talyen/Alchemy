import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { type ElectronApplication, type Page, _electron as electron } from "playwright";

const previewPort = Number.parseInt(process.env.PLAYWRIGHT_ELECTRON_PREVIEW_PORT ?? "4175", 10);
const rendererUrl = `http://127.0.0.1:${previewPort}`;

function ensureElectronBinary(): void {
  const require = createRequire(import.meta.url);
  try {
    require("electron");
    return;
  } catch {
    // CI runners may set ELECTRON_SKIP_BINARY_DOWNLOAD; install explicitly.
  }

  const env = { ...process.env };
  delete env.ELECTRON_SKIP_BINARY_DOWNLOAD;
  execFileSync("node", ["node_modules/electron/install.js"], { cwd: process.cwd(), stdio: "inherit", env });
}

function getElectronExecutablePath(): string {
  ensureElectronBinary();
  const require = createRequire(import.meta.url);
  return require("electron") as string;
}

export async function launchElectronApp(): Promise<ElectronApplication> {
  const args = process.env.CI ? [".", "--no-sandbox", "--disable-gpu"] : ["."];

  return electron.launch({
    executablePath: getElectronExecutablePath(),
    args,
    cwd: process.cwd(),
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
