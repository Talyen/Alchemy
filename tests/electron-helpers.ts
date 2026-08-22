import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type ElectronApplication, type Page, _electron as electron } from "playwright";
import { resolveElectronExecutablePathWithMarker } from "../scripts/electron-path.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function getPreviewPort(): number {
  return Number.parseInt(process.env.PLAYWRIGHT_ELECTRON_PREVIEW_PORT ?? "4175", 10);
}

function getRendererUrl(): string {
  return `http://127.0.0.1:${getPreviewPort()}`;
}

function getElectronExecutablePath(): string {
  const executablePath = resolveElectronExecutablePathWithMarker();
  if (!fs.existsSync(executablePath)) {
    throw new Error(
      `Electron executable missing at ${executablePath}. Run "npm run ensure:electron" before desktop smoke tests.`,
    );
  }
  return executablePath;
}

export async function launchElectronApp(
  options: { packagedRenderer?: boolean; enableGpu?: boolean } = {},
): Promise<ElectronApplication> {
  // Performance profiling must keep the GPU enabled; CI smoke tests disable it.
  const args = process.env.CI && !options.enableGpu ? [".", "--no-sandbox", "--disable-gpu"] : ["."];

  return electron.launch({
    executablePath: getElectronExecutablePath(),
    args,
    cwd: projectRoot,
    env: {
      ...process.env,
      ELECTRON_RENDERER_URL: getRendererUrl(),
      ...(options.packagedRenderer ? { ELECTRON_FORCE_PACKAGED_RENDERER: "1" } : {}),
    },
  });
}

export async function getElectronMainWindow(app: ElectronApplication): Promise<Page> {
  const window = await app.firstWindow();
  await window.waitForLoadState("domcontentloaded");
  return window;
}
