import { createRequire } from "node:module";
import { type ElectronApplication, type Page, _electron as electron } from "playwright";

const require = createRequire(import.meta.url);
const electronPath = require("electron") as string;

const previewPort = Number.parseInt(process.env.PLAYWRIGHT_ELECTRON_PREVIEW_PORT ?? "4175", 10);
const rendererUrl = `http://127.0.0.1:${previewPort}`;

export async function launchElectronApp(): Promise<ElectronApplication> {
  const args = process.env.CI ? [".", "--no-sandbox", "--disable-gpu"] : ["."];

  return electron.launch({
    executablePath: electronPath,
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
