import fs from "node:fs";
import { defineConfig } from "@playwright/test";
import { createAlchemyPlaywrightConfig } from "./tests/playwright-shared";
import type { VisualScenarioOptions } from "./scripts/visual-scenario.mjs";

// Static discovery needs no active capture; the fixture requires a manifest.
const scenario = process.env.ALCHEMY_VISUAL_SCENARIO_FILE
  ? (JSON.parse(fs.readFileSync(process.env.ALCHEMY_VISUAL_SCENARIO_FILE, "utf8")) as VisualScenarioOptions)
  : { viewport: { width: 1920, height: 1080 } };

export default defineConfig(createAlchemyPlaywrightConfig("e2e"), {
  testDir: "./tests/visual-review",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  use: {
    viewport: scenario.viewport,
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
    locale: "en-US",
    timezoneId: "UTC",
    colorScheme: "dark",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium", viewport: scenario.viewport, deviceScaleFactor: 1 } }],
});
