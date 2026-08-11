import { MenuPage } from "../../tests/pages/menu-page";
import { delay } from "../delay";
import { expect, test } from "../fixtures";

const MEASURE_MS = Number.parseInt(process.env.PERF_MEASURE_MS ?? "60000", 10);

test.describe("memory-soak", () => {
  test("repeated collection and talents route lifecycle", async ({ measureScenario }) => {
    await measureScenario({
      scenario: "memory-soak",
      profile: "transition",
      minFrames: Number.parseInt(process.env.PERF_MIN_FRAMES ?? "500", 10),
      setup: async (page) => {
        const menu = new MenuPage(page);
        await menu.gotoWithUnlockedMeta();
        await menu.openCollection();
      },
      interact: async (page, phase) => {
        const deadline = Date.now() + MEASURE_MS;
        while (Date.now() < deadline) {
          await phase("collection-route");
          await page.getByRole("button", { name: "Open collection menu" }).click();
          await page.getByRole("button", { name: "Talents" }).click();
          await expect(page.getByRole("heading", { name: "Talents" })).toBeVisible();
          await delay(150);
          await phase("talents-route");
          await page.getByRole("button", { name: "Open talents menu" }).click();
          await page.getByRole("button", { name: "Collection" }).click();
          await expect(page.getByRole("heading", { name: "Collection" })).toBeVisible();
          await delay(150);
        }
      },
    });
  });
});
