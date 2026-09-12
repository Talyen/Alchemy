import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { type ElectronApplication, type Page, _electron as electron } from "@playwright/test";
import { resolveElectronExecutablePathWithMarker } from "../../scripts/electron-path.mjs";
import { ELECTRON_PREVIEW_PORT, previewPortFromEnv } from "../playwright-shared";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function getPreviewPort(): number {
  return previewPortFromEnv("PLAYWRIGHT_ELECTRON_PREVIEW_PORT", ELECTRON_PREVIEW_PORT);
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
  const args =
    process.env.CI && !options.enableGpu
      ? [".", "--no-sandbox", "--disable-gpu", "--mute-audio"]
      : [".", "--mute-audio"];

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "alchemy-electron-test-"));
  const removeProfile = () => fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  let application: ElectronApplication | undefined;
  try {
    application = await electron.launch({
      executablePath: getElectronExecutablePath(),
      args: ["--require", path.join(projectRoot, "tests/electron/profile.cjs"), ...args],
      cwd: projectRoot,
      env: {
        ...process.env,
        ALCHEMY_ELECTRON_TEST_PROFILE: profile,
        ELECTRON_RENDERER_URL: getRendererUrl(),
        ...(options.packagedRenderer ? { ELECTRON_FORCE_PACKAGED_RENDERER: "1" } : {}),
      },
    });
    application.once("close", removeProfile);
    const actualProfile = await application.evaluate(({ app }) => app.getPath("userData"));
    if (actualProfile !== profile) throw new Error("Electron test profile isolation failed");
    return application;
  } catch (error) {
    await application?.close().catch(() => undefined);
    removeProfile();
    throw error;
  }
}

export async function getElectronMainWindow(app: ElectronApplication): Promise<Page> {
  const window = await app.firstWindow();
  await window.waitForLoadState("domcontentloaded");
  return window;
}
