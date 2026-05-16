import { expect, test } from "@playwright/test";
import { startAtDestination, playUntilVictory } from "./helpers";

test.describe("Elite Combat", () => {
  test("elite combat destination starts a battle that can be won", async ({ page }) => {
    await startAtDestination(page);

    const eliteBtn = page.getByRole("button", { name: "Elite Combat" });
    if (!(await eliteBtn.isVisible({ timeout: 500 }).catch(() => false))) {
      test.skip(true, "Elite Combat not among destination choices");
      return;
    }
    await eliteBtn.click();
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10000 });

    await playUntilVictory(page);

    await expect(page.getByRole("heading", { name: /^Victory/ })).toBeVisible();
    await page.locator('[aria-label^="Select "]').first().click();
    await page.getByRole("button", { name: /^(Add Card|Take Trinket)$/ }).click();
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 5000 });
  });
});
