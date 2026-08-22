import { defineConfig } from "@playwright/test";
import { playwrightCiSettings } from "./tests/playwright-shared";

const previewPort = Number.parseInt(process.env.PLAYWRIGHT_ELECTRON_PREVIEW_PORT ?? "4175", 10);
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
    command: `npx vite preview --host 127.0.0.1 --port ${previewPort} --strictPort`,
    port: previewPort,
    reuseExistingServer: !isCi,
  },
});
