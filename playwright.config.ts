import os from "node:os";
import { defineConfig, devices } from "@playwright/test";
import { BROWSER_PREVIEW_PORT, playwrightCiSettings, previewWebServer } from "./tests/playwright-shared";

const viteMode = process.env.PLAYWRIGHT_VITE_MODE === "preview" ? "preview" : "dev";
const port = BROWSER_PREVIEW_PORT;
const webServerCommand = previewWebServer(port, { mode: viteMode }).command;

const isPrepush = process.env.PLAYWRIGHT_PREPUSH === "1";
const isNightly = process.env.PLAYWRIGHT_NIGHTLY === "1";
const isCi = !!process.env.CI && !isPrepush;
const isFullE2eSuite = process.env.PLAYWRIGHT_E2E_FULL === "1";
// Critical CI job: fail fast. Full suite (~100 tests): report up to 5 failures per run.
const maxFailures = isFullE2eSuite ? 5 : isCi ? 1 : 0;

const defaultWorkers = Math.min(3, Math.max(2, os.cpus().length > 1 ? os.cpus().length - 1 : 2));

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  testIgnore: ["**/electron-smoke.spec.ts", "**/electron-security.spec.ts"],
  // Every E2E test is state-isolated (each injects its own localStorage), so the
  // CI gate runs fully parallel for throughput. Disable animations via fastBattle
  // where applicable; the raw-animation canaries are isolated per-context.
  fullyParallel: isPrepush || isNightly || isFullE2eSuite || isCi,
  maxFailures,
  workers: isNightly ? 4 : isCi ? 4 : defaultWorkers,
  globalTimeout: 600_000,
  timeout: isCi ? 30_000 : 20_000,
  ...playwrightCiSettings({ isCi, defaultJsonOut: "reports/playwright-results.json" }),
  // Keep only failed-run output locally/CI so successful shards do not accumulate under test-results/.
  preserveOutput: "failures-only",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: isPrepush ? "off" : "retain-on-failure",
    actionTimeout: isCi ? 15_000 : 10_000,
    storageState: {
      cookies: [],
      origins: [
        {
          origin: `http://127.0.0.1:${port}`,
          localStorage: [{ name: "alchemy-skip-loading-screen", value: "true" }],
        },
      ],
    },
  },
  webServer: {
    command: webServerCommand,
    port,
    reuseExistingServer: !isCi,
    env: { ALCHEMY_DEV_PORT: String(port), ALCHEMY_SKIP_CHECKER: "1" },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1920, height: 1080 } },
    },
  ],
});
