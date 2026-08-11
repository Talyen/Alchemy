import { MenuPage } from "../../tests/pages/menu-page";
import { delay } from "../delay";
import { expect, test } from "../fixtures";

const MEASURE_MS = Number.parseInt(process.env.PERF_MEASURE_MS ?? "12000", 10);

test.describe("options-brightness", () => {
  test("animated stage at dim and boosted brightness", async ({ measureScenario }) => {
    await measureScenario({
      scenario: "options-brightness",
      profile: "continuous",
      minFrames: Number.parseInt(process.env.PERF_MIN_FRAMES ?? "250", 10),
      setup: async (page) => {
        const menu = new MenuPage(page);
        await menu.goto();
        await menu.openOptions();
      },
      interact: async (page, phase) => {
        const brightness = page.locator('input[type="range"]').first();
        const deadline = Date.now() + MEASURE_MS;
        let boosted = false;
        while (Date.now() < deadline) {
          boosted = !boosted;
          await phase(boosted ? "brightness-boosted" : "brightness-dimmed");
          await brightness.fill(boosted ? "150" : "50");
          await delay(350);
        }
        await expect(page.getByRole("heading", { name: "Options" })).toBeVisible();
      },
    });
  });
});
