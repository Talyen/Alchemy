import { defineConfig } from "@playwright/test";
import { previewPortFromEnv, previewWebServer } from "./tests/playwright-base";

export default defineConfig({
  testDir: "./tests/layout-review",
  workers: 1,
  fullyParallel: false,
  timeout: process.env.CI ? 0 : 600_000,
  globalTimeout: process.env.CI ? 0 : 3_600_000,
  retries: 0,
  expect: { timeout: 15_000 },
  reporter: [["line"]],
  use: { actionTimeout: 15_000 },
  webServer: {
    ...previewWebServer(previewPortFromEnv("PLAYWRIGHT_ELECTRON_PREVIEW_PORT", 4277)),
  },
});
