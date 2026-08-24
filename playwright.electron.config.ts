import { defineConfig } from "@playwright/test";
import {
  ELECTRON_PREVIEW_PORT,
  playwrightCiSettings,
  previewPortFromEnv,
  previewWebServer,
} from "./tests/playwright-shared";

const previewPort = previewPortFromEnv("PLAYWRIGHT_ELECTRON_PREVIEW_PORT", ELECTRON_PREVIEW_PORT);
const isCi = !!process.env.CI;

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/electron-*.spec.ts",
  globalSetup: "./tests/electron-global-setup.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  globalTimeout: 600_000,
  ...playwrightCiSettings({ isCi, defaultJsonOut: "reports/playwright-electron-results.json" }),
  preserveOutput: "failures-only",
  webServer: {
    ...previewWebServer(previewPort),
    reuseExistingServer: !isCi,
  },
});
