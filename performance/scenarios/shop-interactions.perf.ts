import { ShopPage } from "../../tests/pages/shop-page";
import { startAtDestination } from "../../tests/e2e/battle-setup";
import { delay } from "../delay";
import { expect, test } from "../fixtures";

const MEASURE_MS = Number.parseInt(process.env.PERF_MEASURE_MS ?? "15000", 10);

test.describe("shop-interactions", () => {
  test("shop card-grid hover and refresh transitions", async ({ measureScenario }) => {
    await measureScenario({
      scenario: "shop-interactions",
      profile: "transition",
      minFrames: Number.parseInt(process.env.PERF_MIN_FRAMES ?? "250", 10),
      setup: async (page) => {
        await startAtDestination(page, { runGold: 9999 }, { forceDestination: "Card Shop" });
        await page.getByRole("button", { name: "Card Shop" }).click();
        await expect(page.getByRole("heading", { name: "Card Shop" })).toBeVisible();
      },
      interact: async (page, phase) => {
        const shop = new ShopPage(page);
        const deadline = Date.now() + MEASURE_MS;
        let index = 0;
        let refreshed = false;

        while (Date.now() < deadline) {
          const inspectCount = await shop.inspectButtons.count();
          if (inspectCount > 0) {
            await phase("shop-card-hover");
            await shop.inspectButtons.nth(index % inspectCount).hover();
          }
          if (!refreshed && index >= 2) {
            await phase("shop-refresh");
            await shop.refresh();
            await expect(shop.inspectButtons.first()).toBeVisible();
            refreshed = true;
          }
          index += 1;
          await delay(220);
        }
      },
    });
  });
});
