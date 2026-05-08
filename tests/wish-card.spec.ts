import { expect, test } from "@playwright/test";
import { startRun } from "./helpers";

test.describe("Wish Card", () => {
  test("playing wish card shows overlay with three choices", async ({ page }) => {
    await startRun(page);

    const wishCard = page.getByRole("button", { name: /Play Wish/ });
    if (!(await wishCard.isVisible({ timeout: 500 }).catch(() => false))) {
      test.skip(true, "Wish card not in initial hand");
      return;
    }

    await wishCard.click();
    await page.waitForTimeout(300);

    // Wish overlay should show 3 card options
    const wishChoices = page.locator('[aria-label^="Select Card"]');
    await expect(wishChoices).toHaveCount(3);
  });
});
