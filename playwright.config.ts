import os from "node:os";
import { defineConfig, devices } from "@playwright/test";

const viteMode = process.env.PLAYWRIGHT_VITE_MODE === "preview" ? "preview" : "dev";
const webServerCommand =
  viteMode === "preview"
    ? "npx vite preview --host 127.0.0.1 --port 4173 --strictPort"
    : "npx vite --host 127.0.0.1 --port 4173 --strictPort";

const isPrepush = process.env.PLAYWRIGHT_PREPUSH === "1";
const isNightly = process.env.PLAYWRIGHT_NIGHTLY === "1";
const isCi = !!process.env.CI && !isPrepush;
const isFullE2eSuite = process.env.PLAYWRIGHT_E2E_FULL === "1";
// Critical CI job: fail fast. Full suite (~100 tests): report up to 5 failures per run.
const maxFailures = isFullE2eSuite ? 5 : isCi ? 1 : 0;
const playwrightJsonOut = process.env.PLAYWRIGHT_JSON_OUTPUT_NAME ?? "reports/playwright-results.json";

const prepushWorkers = Math.min(4, Math.max(2, os.cpus().length > 1 ? os.cpus().length - 1 : 2));

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  testIgnore: "**/electron-smoke.spec.ts",
  // Every E2E test is state-isolated (each injects its own localStorage), so the
  // CI gate runs fully parallel for throughput. Disable animations via fastBattle
  // where applicable; the raw-animation canaries are isolated per-context.
  fullyParallel: isPrepush || isNightly || isFullE2eSuite || isCi,
  maxFailures,
  workers: isPrepush ? prepushWorkers : isNightly ? 4 : isCi ? 4 : 4,
  globalTimeout: 600_000,
  timeout: isCi ? 30_000 : 15_000,
  retries: isCi ? 1 : 0,
  forbidOnly: isCi,
  // Keep only failed-run output locally/CI so successful shards do not accumulate under test-results/.
  preserveOutput: "failures-only",
  // CI: github annotations + compact console + HTML artifact + JSON for step summary.
  reporter: isPrepush
    ? "line"
    : isCi
      ? [["github"], ["line"], ["html"], ["json", { outputFile: playwrightJsonOut }]]
      : "html",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: isPrepush ? "off" : "retain-on-failure",
    actionTimeout: isCi ? 15_000 : 10_000,
    storageState: {
      cookies: [],
      origins: [
        {
          origin: "http://127.0.0.1:4173",
          localStorage: [{ name: "alchemy-skip-loading-screen", value: "true" }],
        },
      ],
    },
  },
  webServer: {
    command: webServerCommand,
    port: 4173,
    reuseExistingServer: !isCi,
    env: { ALCHEMY_DEV_PORT: "4173" },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1920, height: 1080 } },
    },
  ],
});
