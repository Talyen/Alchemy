import fs from "node:fs";
import path from "node:path";
import { test, expect } from "../fixtures/e2e";
import { seedRandom } from "../browser-helpers";
import { waitForLayoutSettled } from "../e2e/layout-assertions";
import { openVisualScenario } from "../visual/scenarios";
import type { VisualScenarioOptions } from "../../scripts/visual-scenario.mjs";

test("capture the requested reproducible visual scenario", async ({ page, fastBattle }) => {
  void fastBattle;
  const manifestPath = process.env.ALCHEMY_VISUAL_SCENARIO_FILE;
  if (!manifestPath) throw new Error("Use npm run visual:scenario -- <scenario>");
  const scenario = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as VisualScenarioOptions;
  await seedRandom(page, scenario.seed);
  await page.clock.setFixedTime(new Date("2026-01-01T00:00:00.000Z"));
  await openVisualScenario(page, scenario.scenario, scenario.locale);
  await waitForLayoutSettled(page);
  await page.mouse.move(0, 0);
  await expect.poll(() => page.evaluate(() => ({ width: innerWidth, height: innerHeight }))).toEqual(scenario.viewport);
  const directory = path.dirname(manifestPath);
  fs.writeFileSync(
    path.join(directory, "capture.json"),
    JSON.stringify(
      {
        viewport: page.viewportSize(),
        locale: await page.locator("html").getAttribute("lang"),
        browserVersion: page.context().browser()?.version(),
        platform: process.platform,
        headings: await page.getByRole("heading").allTextContents(),
      },
      null,
      2,
    ),
  );
  await page.context().storageState({ path: path.join(directory, "storage.json"), indexedDB: true });
  await page.screenshot({
    path: path.join(directory, "screen.png"),
    animations: "disabled",
    caret: "hide",
    scale: "css",
  });
});
