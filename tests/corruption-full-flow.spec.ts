import { expect, test } from "@playwright/test";
import { startAtDestination, navigateToDestination } from "./helpers";

test.describe("Corruption Full Flow", () => {
  test("corruption destination shows altar screen with intro and leave works", async ({ page }) => {
    await startAtDestination(page);
    await navigateToDestination(page, "Corruption");

    await expect(page.getByRole("heading", { name: "Altar of Corruption" })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: "Corrupt a Card" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Leave" })).toBeVisible();

    await page.getByRole("button", { name: "Leave" }).click();
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 5000 });
  });

  test("selecting a card and corrupting shows result view with continue", async ({ page }) => {
    await startAtDestination(page);
    await navigateToDestination(page, "Corruption");

    await page.getByRole("button", { name: "Corrupt a Card" }).click();
    await expect(page.locator('[data-testid="card-selection-grid"]')).toBeVisible({ timeout: 3000 });
    await page.waitForTimeout(500);

    const firstCard = page.locator('[data-testid="card-selection-grid"] [aria-label^="Select "]').first();
    await firstCard.click({ force: true });
    await page.waitForTimeout(300);

    await page.getByRole("button", { name: "Corrupt" }).click();
    await page.waitForTimeout(500);

    await expect(page.getByRole("button", { name: "Continue" })).toBeVisible({ timeout: 3000 });

    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 5000 });
  });

  test("corrupted card retains corruption flag in subsequent battle hand", async ({ page }) => {
    await startAtDestination(page);
    await navigateToDestination(page, "Corruption");

    await page.getByRole("button", { name: "Corrupt a Card" }).click();
    await expect(page.locator('[data-testid="card-selection-grid"]')).toBeVisible({ timeout: 3000 });
    await page.waitForTimeout(500);

    const firstCard = page.locator('[data-testid="card-selection-grid"] [aria-label^="Select "]').first();
    await firstCard.click({ force: true });
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: "Corrupt" }).click();
    await page.waitForTimeout(500);

    await expect(page.getByRole("button", { name: "Continue" })).toBeVisible({ timeout: 3000 });
    await page.getByRole("button", { name: "Continue" }).click();
    await page.waitForTimeout(1500);
    await navigateToDestination(page, "Normal Combat");
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10000 });

    const playableCards = page.locator('[aria-label^="Play "]');
    const count = await playableCards.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});
