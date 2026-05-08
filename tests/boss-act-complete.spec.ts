import { expect, test } from "@playwright/test";
import { startRun } from "./helpers";

async function skipCombat(page: Parameters<typeof test>[0]["page"]) {
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("button", { name: "Skip Combat" }).click();
  await page.waitForTimeout(500);
  await expect(page.getByRole("heading", { name: /^Victory/ })).toBeVisible({ timeout: 5000 });
}

async function pickRewardAndDestination(page: Parameters<typeof test>[0]["page"]) {
  await page.locator('[aria-label^="Select "]').first().click();
  await page.getByRole("button", { name: /^(Add Card|Take Trinket)$/ }).click();
}

test.describe("Boss Battle and Act Complete", () => {
  test("defeating act boss shows act-complete screen and allows advancing to next act", async ({ page }) => {
    await startRun(page);

    // Play through 7 normal combats using dev-mode skip to reach the boss
    for (let i = 0; i < 7; i++) {
      await skipCombat(page);
      await pickRewardAndDestination(page);

      if (i < 6) {
        // After 6 destination choices, the 7th automatically triggers the boss
        await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 10000 });
        await page.getByRole("button", { name: /Combat/ }).first().click();
      }
    }

    // Boss battle should auto-start. Skip it.
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10000 });
    await skipCombat(page);

    // Boss rewards, then act-complete
    await pickRewardAndDestination(page);
    await expect(page.getByText(/Act \d Complete/)).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: /Enter Act \d+/ })).toBeVisible();
  });
});
