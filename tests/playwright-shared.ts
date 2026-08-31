import os from "node:os";
import { defineConfig, devices } from "@playwright/test";
import type { ReporterDescription } from "@playwright/test";
import { ensureRunId } from "../scripts/lib/current-run.mjs";
import {
  BROWSER_PREVIEW_PORT,
  ELECTRON_PREVIEW_PORT,
  PERF_PREVIEW_PORT,
  resolvePort,
} from "../scripts/lib/dev-port.mjs";
import { PERF_VIEWPORT } from "../performance/viewport";

export { ELECTRON_PREVIEW_PORT } from "../scripts/lib/dev-port.mjs";

export function previewPortFromEnv(envName: string, fallback: number): number {
  return resolvePort(envName, fallback);
}

function previewWebServer(
  port: number,
  { mode = "preview" }: { mode?: "dev" | "preview" } = {},
): { command: string; port: number } {
  ensureRunId("playwright");
  return {
    command: `vite${mode === "dev" ? "" : " preview"} --host 127.0.0.1 --port ${port} --strictPort`,
    port,
  };
}

interface PlaywrightCiSettingsOptions {
  isCi: boolean;
  defaultJsonOut: string;
}

function playwrightCiSettings({ isCi, defaultJsonOut }: PlaywrightCiSettingsOptions): {
  retries: 0 | 1;
  forbidOnly: boolean;
  reporter: ReporterDescription[];
} {
  const jsonOutputFile = process.env.PLAYWRIGHT_JSON_OUTPUT_NAME ?? defaultJsonOut;
  return {
    retries: isCi ? 1 : 0,
    forbidOnly: isCi,
    reporter: isCi
      ? [
          ["./scripts/lib/playwright-run-reporter.mjs"],
          ["github"],
          ["line"],
          ["html"],
          ["json", { outputFile: jsonOutputFile }],
        ]
      : [["./scripts/lib/playwright-run-reporter.mjs"], ["line"], ["html", { open: "never" }]],
  };
}

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
      timeout: 90_000,
      globalTimeout: 600_000,
      ...playwrightCiSettings({ isCi, defaultJsonOut: "reports/playwright-electron-results.json" }),
      preserveOutput: "failures-only",
      webServer: {
        ...previewWebServer(previewPort),
        reuseExistingServer: !isCi,
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
      timeout: isTrace ? 180_000 : 300_000,
      globalTimeout: 1_800_000,
      forbidOnly: false,
      reporter: [["list"], ["./performance/reporter.ts"]],
      use: {
        baseURL: `http://127.0.0.1:${previewPort}`,
        headless: false,
        trace: "off",
        actionTimeout: 30_000,
        viewport: { ...PERF_VIEWPORT },
      },
      webServer: {
        ...previewWebServer(previewPort),
        reuseExistingServer: false,
        env: { ALCHEMY_DEV_PORT: String(previewPort) },
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
  const maxFailures = isFullE2eSuite ? 5 : isCi ? 1 : 0;
  const defaultWorkers = Math.min(6, Math.max(3, os.cpus().length > 1 ? os.cpus().length - 1 : 3));
  return defineConfig({
    testDir: "./tests",
    testMatch: "**/*.spec.ts",
    testIgnore: ["**/electron-smoke.spec.ts", "**/electron-security.spec.ts"],
    fullyParallel: true,
    maxFailures: isPrepush ? 5 : maxFailures,
    workers: isPrepush ? 2 : isNightly || isCi ? Math.min(6, Math.max(4, os.cpus().length)) : defaultWorkers,
    globalTimeout: 600_000,
    timeout: isCi ? 30_000 : 20_000,
    ...playwrightCiSettings({ isCi, defaultJsonOut: "reports/playwright-results.json" }),
    preserveOutput: "failures-only",
    use: {
      baseURL: `http://127.0.0.1:${port}`,
      trace: isPrepush ? "off" : "retain-on-failure",
      actionTimeout: isCi ? 15_000 : 10_000,
      launchOptions: { args: ["--mute-audio"] },
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
}
