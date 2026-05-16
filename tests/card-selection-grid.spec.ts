import { expect, test } from "@playwright/test";
import { startAtDestination, navigateToDestination } from "./helpers";

test.describe("Card Selection Grid", () => {
  test("cards are centered within the viewport", async ({ page }) => {
    await startAtDestination(page, { runGold: 200 });
    await navigateToDestination(page, "Merchant's Shop");
    await expect(page.getByRole("heading", { name: "Merchant's Shop" })).toBeVisible();

    const removeBtn = page.getByRole("button", { name: /Remove Card/ });
    await expect(removeBtn).toBeVisible();
    if (!(await removeBtn.isEnabled())) {
      test.skip(true, "Not enough gold to remove a card");
      return;
    }
    await removeBtn.click();

    const grid = page.locator('[data-testid="card-selection-grid"]');
    await expect(grid).toBeVisible({ timeout: 3000 });
    await page.waitForTimeout(500);

    const isCentered = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="card-selection-grid"]');
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      const gridCenter = rect.left + rect.width / 2;
      const viewportCenter = window.innerWidth / 2;
      return Math.abs(gridCenter - viewportCenter) < 50;
    });
    expect(isCentered).toBe(true);
  });
});
