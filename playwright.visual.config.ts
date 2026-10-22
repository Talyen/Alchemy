import { defineConfig } from "@playwright/test";
import { createAlchemyPlaywrightConfig } from "./tests/playwright-shared";

// Pixel baselines use one OS/browser pair; functional suites stay cross-platform.
export default defineConfig(createAlchemyPlaywrightConfig("e2e"), {
  testDir: "./tests/visual",
  fullyParallel: false,
  workers: 1,
  snapshotPathTemplate: "{testDir}/baselines/{platform}/{arg}{ext}",
  expect: {
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      scale: "css",
      maxDiffPixels: 100,
    },
  },
  use: { reducedMotion: "reduce", locale: "en-US", timezoneId: "UTC", colorScheme: "dark" },
});
