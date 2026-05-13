import { expect, test } from "@playwright/test";
import { startRun, skipAndReward, navigateToDestination } from "./helpers";

test.describe("Corruption Screen", () => {
  test("corruption destination shows altar screen with intro", async ({ page }) => {
    test.setTimeout(120000);
    await startRun(page);
    await skipAndReward(page);
    await navigateToDestination(page, "Corruption");

    await expect(page.getByRole("heading", { name: "Altar of Corruption" })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: "Corrupt a Card" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Leave" })).toBeVisible();
  });

  test("selecting a card corrupts it and shows result", async ({ page }) => {
    test.setTimeout(120000);
    await startRun(page);
    await skipAndReward(page);
    await navigateToDestination(page, "Corruption");

    await page.getByRole("button", { name: "Corrupt a Card" }).click();
    await expect(page.locator('[data-testid="card-selection-grid"]')).toBeVisible({ timeout: 3000 });

    await page.waitForTimeout(500);
    const corruptCard = page.locator('[data-testid="card-selection-grid"] [aria-label^="Select "]').first();
    await corruptCard.click({ force: true });
    await page.waitForTimeout(300);

    await page.getByRole("button", { name: "Corrupt" }).click();
    await page.waitForTimeout(300);

    await expect(page.getByRole("button", { name: "Continue" })).toBeVisible({ timeout: 3000 });

    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 5000 });
  });

  test("leave button exits corruption altar", async ({ page }) => {
    test.setTimeout(120000);
    await startRun(page);
    await skipAndReward(page);
    await navigateToDestination(page, "Corruption");

    await page.getByRole("button", { name: "Leave" }).click();
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 5000 });
  });
});
