import { defineConfig } from "@playwright/test";

const previewPort = Number.parseInt(process.env.PLAYWRIGHT_ELECTRON_PREVIEW_PORT ?? "4175", 10);
const isCi = !!process.env.CI;

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/electron-smoke.spec.ts",
  globalSetup: "./tests/electron-global-setup.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  retries: isCi ? 1 : 0,
  forbidOnly: isCi,
  reporter: isCi ? [["github"], ["html"]] : "html",
  webServer: {
    command: `npx vite preview --host 127.0.0.1 --port ${previewPort} --strictPort`,
    port: previewPort,
    reuseExistingServer: !isCi,
  },
});
