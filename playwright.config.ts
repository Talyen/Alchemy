import { defineConfig, devices } from "@playwright/test";

const viteMode = process.env.PLAYWRIGHT_VITE_MODE === "preview" ? "preview" : "dev";
const webServerCommand = viteMode === "preview"
  ? "npx vite preview --host 127.0.0.1 --port 4173 --strictPort"
  : "npx vite --host 127.0.0.1 --port 4173 --strictPort";

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  fullyParallel: !process.env.CI,
  workers: process.env.CI ? 1 : 4,
  globalTimeout: 600_000,
  timeout: process.env.CI ? 30_000 : 15_000,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  reporter: "html",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
    actionTimeout: process.env.CI ? 15_000 : 10_000,
  },
  webServer: {
    command: webServerCommand,
    port: 4173,
    reuseExistingServer: !process.env.CI,
    env: { ALCHEMY_DEV_PORT: "4173" },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1920, height: 1080 } },
    },
  ],
});
