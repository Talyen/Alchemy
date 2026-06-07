import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { type ElectronApplication, type Page, _electron as electron } from "playwright";

const previewPort = Number.parseInt(process.env.PLAYWRIGHT_ELECTRON_PREVIEW_PORT ?? "4175", 10);
const rendererUrl = `http://127.0.0.1:${previewPort}`;

function getElectronExecutablePath(): string {
  execFileSync("node", ["scripts/ensure-electron.mjs"], { cwd: process.cwd(), stdio: "inherit" });

  const electronRoot = path.join(process.cwd(), "node_modules", "electron");
  const relativePath = fs.readFileSync(path.join(electronRoot, "path.txt"), "utf8").trim();
  const executablePath = path.join(electronRoot, "dist", relativePath);

  if (!fs.existsSync(executablePath)) {
    throw new Error(`Electron executable missing at ${executablePath}`);
  }

  return executablePath;
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
