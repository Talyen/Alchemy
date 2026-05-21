import { expect, test } from "@playwright/test";
import { startAtDestination } from "./helpers";

test.describe("Card Selection Grid", () => {
  test("cards are centered within the viewport", async ({ page }) => {
    await startAtDestination(page, { runGold: 9999 }, { forceDestination: "Merchant's Shop" });
    await page.getByRole("button", { name: "Merchant's Shop" }).click();
    await expect(page.getByRole("heading", { name: "Merchant's Shop" })).toBeVisible();

    const removeBtn = page.getByRole("button", { name: /Remove Card/ });
    await expect(removeBtn).toBeVisible();
    await expect(removeBtn).toBeEnabled();
    await removeBtn.click();

    const grid = page.locator('[data-testid="card-selection-grid"]');
    await expect(grid).toBeVisible({ timeout: 3000 });

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
