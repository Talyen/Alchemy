import { enableLoadingScreen, injectHomestead } from "../../tests/e2e/save-injection";
import { MenuPage } from "../../tests/pages/menu-page";
import { delay } from "../delay";
import { expect, test } from "../fixtures";
import { STARTUP_READY_MARK } from "../../src/lib/performance/startup-marks";
import { requirePositiveFiniteObservation } from "../scenario-contracts";

test.describe("startup-first-use", () => {
  test("startup reveal and first route interactions", async ({ measureScenario }) => {
    await measureScenario({
      scenario: "startup-first-use",
      profile: "transition",
      minFrames: Number.parseInt(process.env.PERF_MIN_FRAMES ?? "180", 10),
      captureElectronLaunchTiming: true,
      setup: async (page) => {
        await injectHomestead(page);
        await enableLoadingScreen(page);
        await page.goto("/");
        await new MenuPage(page).expectMainMenuAfterColdStart();
      },
      interact: async (page, phase) => {
        const menu = new MenuPage(page);
        await phase("first-options-open");
        await menu.openOptions();
        await delay(250);
        await phase("first-menu-return");
        await page.getByRole("button", { name: "Open options menu" }).click();
        await page.getByRole("button", { name: "Main Menu", exact: true }).click();
        await expect(menu.playBtn).toBeVisible();
        await delay(2500);
      },
      collectObservations: async (page) => {
        const rendererStartupReadyMs = await page.evaluate(
          (mark) => performance.getEntriesByName(mark, "mark").at(-1)?.startTime,
          STARTUP_READY_MARK,
        );
        return {
          rendererStartupReadyMs: requirePositiveFiniteObservation("rendererStartupReadyMs", rendererStartupReadyMs),
        };
      },
    });
  });
});
