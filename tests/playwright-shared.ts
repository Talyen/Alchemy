import os from "node:os";
import { defineConfig, devices } from "@playwright/test";
import {
  BROWSER_PREVIEW_PORT,
  ELECTRON_PREVIEW_PORT,
  PERF_PREVIEW_PORT,
  TIMEOUTS,
  playwrightCiSettings,
  previewPortFromEnv,
  previewWebServer,
} from "./playwright-base";
import { PERF_VIEWPORT } from "../performance/viewport";

export { ELECTRON_PREVIEW_PORT, previewPortFromEnv } from "./playwright-base";

export type AlchemyPlaywrightPreset = "e2e" | "electron" | "performance";

export function createAlchemyPlaywrightConfig(preset: AlchemyPlaywrightPreset) {
  if (preset === "electron") {
    const previewPort = previewPortFromEnv("PLAYWRIGHT_ELECTRON_PREVIEW_PORT", ELECTRON_PREVIEW_PORT);
    const isCi = !!process.env.CI;
    return defineConfig({
      testDir: "./tests",
      testMatch: "**/electron-*.spec.ts",
      globalSetup: "./tests/electron-global-setup.ts",
      fullyParallel: false,
      workers: 1,
      timeout: TIMEOUTS.electron.timeout,
      globalTimeout: TIMEOUTS.electron.global,
      ...playwrightCiSettings({ isCi, defaultJsonOut: "reports/playwright-electron-results.json" }),
      preserveOutput: "failures-only",
      webServer: {
        ...previewWebServer(previewPort),
        reuseExistingServer: !isCi,
        env: {
          ALCHEMY_DEV_PORT: String(previewPort),
          ...(process.env.ALCHEMY_RUN_ID ? { ALCHEMY_RUN_ID: process.env.ALCHEMY_RUN_ID } : {}),
        },
      },
    });
  }

  if (preset === "performance") {
    const previewPort = previewPortFromEnv("PLAYWRIGHT_PERF_PORT", PERF_PREVIEW_PORT);
    const isElectron = process.env.PLAYWRIGHT_PERF_ELECTRON === "1";
    const isTrace = process.env.PLAYWRIGHT_PERF_TRACE === "1";
    return defineConfig({
      testDir: "./performance/scenarios",
      testMatch: "**/*.perf.ts",
      fullyParallel: false,
      workers: 1,
      retries: 0,
      timeout: isTrace ? TIMEOUTS.performance.trace : TIMEOUTS.performance.normal,
      globalTimeout: TIMEOUTS.performance.global,
      forbidOnly: false,
      reporter: [["list"], ["./performance/reporter.ts"]],
      use: {
        baseURL: `http://127.0.0.1:${previewPort}`,
        headless: false,
        trace: "off",
        actionTimeout: TIMEOUTS.performance.action,
        viewport: { ...PERF_VIEWPORT },
      },
      webServer: {
        ...previewWebServer(previewPort),
        reuseExistingServer: false,
        env: {
          ALCHEMY_DEV_PORT: String(previewPort),
          ...(process.env.ALCHEMY_RUN_ID ? { ALCHEMY_RUN_ID: process.env.ALCHEMY_RUN_ID } : {}),
        },
      },
      projects: [
        isElectron
          ? {
              name: "electron",
              use: {
                viewport: { ...PERF_VIEWPORT },
              },
            }
          : {
              name: "chromium",
              use: {
                ...devices["Desktop Chrome"],
                viewport: { ...PERF_VIEWPORT },
                deviceScaleFactor: 1,
                launchOptions: {
                  args: ["--mute-audio", "--disable-background-timer-throttling", "--disable-renderer-backgrounding"],
                },
              },
            },
      ],
    });
  }

  const viteMode = process.env.PLAYWRIGHT_VITE_MODE === "preview" ? "preview" : "dev";
  const port = BROWSER_PREVIEW_PORT;
  const webServerCommand = previewWebServer(port, { mode: viteMode }).command;
  const isPrepush = process.env.PLAYWRIGHT_PREPUSH === "1";
  const isNightly = process.env.PLAYWRIGHT_NIGHTLY === "1";
  const isCi = !!process.env.CI && !isPrepush;
  const isFullE2eSuite = process.env.PLAYWRIGHT_E2E_FULL === "1";
  const maxFailures = isFullE2eSuite ? 5 : isCi ? 3 : 0;
  const defaultWorkers = Math.min(6, Math.max(3, os.cpus().length > 1 ? os.cpus().length - 1 : 3));
  return defineConfig({
    testDir: "./tests",
    testMatch: "**/*.spec.ts",
    testIgnore: ["**/electron-smoke.spec.ts", "**/electron-security.spec.ts"],
    fullyParallel: true,
    maxFailures: isPrepush ? 5 : maxFailures,
    workers: isPrepush ? 2 : isNightly || isCi ? Math.min(6, Math.max(4, os.cpus().length)) : defaultWorkers,
    globalTimeout: TIMEOUTS.e2e.global,
    timeout: isCi ? TIMEOUTS.e2e.ci : TIMEOUTS.e2e.local,
    ...playwrightCiSettings({ isCi, defaultJsonOut: "reports/playwright-results.json" }),
    preserveOutput: "failures-only",
    use: {
      baseURL: `http://127.0.0.1:${port}`,
      trace: isPrepush ? "off" : "retain-on-failure",
      actionTimeout: isCi ? TIMEOUTS.e2e.actionCi : TIMEOUTS.e2e.actionLocal,
      launchOptions: { args: ["--mute-audio"] },
      ...(process.env.PLAYWRIGHT_COLD_BOOT === "1"
        ? {}
        : {
            storageState: {
              cookies: [],
              origins: [
                {
                  origin: `http://127.0.0.1:${port}`,
                  localStorage: [{ name: "alchemy-skip-loading-screen", value: "true" }],
                },
              ],
            },
          }),
    },
    webServer: {
      command: webServerCommand,
      port,
      reuseExistingServer: !isCi,
      env: {
        ALCHEMY_DEV_PORT: String(port),
        ALCHEMY_SKIP_CHECKER: "1",
        ...(process.env.ALCHEMY_RUN_ID ? { ALCHEMY_RUN_ID: process.env.ALCHEMY_RUN_ID } : {}),
      },
    },
    projects: [
      {
        name: "chromium",
        use: { ...devices["Desktop Chrome"], viewport: { width: 1920, height: 1080 } },
      },
    ],
  });
}
