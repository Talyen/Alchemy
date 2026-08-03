import { defineConfig, devices } from "@playwright/test";
import { PERF_VIEWPORT } from "./performance/viewport";

const previewPort = Number.parseInt(process.env.PLAYWRIGHT_PERF_PORT ?? "4176", 10);
const isElectron = process.env.PLAYWRIGHT_PERF_ELECTRON === "1";
const isTrace = process.env.PLAYWRIGHT_PERF_TRACE === "1";

/**
 * On-demand FPS / hitch profiling — never discovered by the main E2E config.
 * Run via `npm run perf` / `npm run perf:trace` (see docs/PERFORMANCE.md).
 *
 * Viewport is MacBook Air 13" logical (1440×900) so headed runs fit on-screen.
 * Do not skip the startup loading gate here — idle art preload needs that window
 * or battle portraits can paint blank.
 */
export default defineConfig({
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
    // No alchemy-skip-loading-screen: allow the short startup gate so allGameArt
    // idle-preloads before combat (blank portraits were common when skipping).
  },
  webServer: {
    command: `npx vite preview --host 127.0.0.1 --port ${previewPort} --strictPort`,
    port: previewPort,
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
              args: ["--disable-background-timer-throttling", "--disable-renderer-backgrounding"],
            },
          },
        },
  ],
});
