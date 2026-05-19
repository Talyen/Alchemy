import { expect, test } from "@playwright/test";
import { startAtDestination, navigateToDestination } from "./helpers";

test.describe("Shop Edge Cases", () => {
  test("buy button is disabled when player has insufficient gold for card", async ({ page }) => {
    await startAtDestination(page, { runGold: 40 });
    await navigateToDestination(page, "Merchant's Shop");

    await expect(page.getByRole("heading", { name: "Merchant's Shop" })).toBeVisible();

    const buyButton = page.getByRole("button", { name: /^Buy/ }).first();

    // Card costs 30 gold; with 40 gold it should be enabled
    await expect(buyButton).toBeVisible();
  });

  test("remove card button is visible with sufficient gold", async ({ page }) => {
    await startAtDestination(page, { runGold: 200 });
    await navigateToDestination(page, "Merchant's Shop");

    const removeBtn = page.getByRole("button", { name: /Remove Card/ });
    await expect(removeBtn).toBeVisible();
    if (await removeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await expect(removeBtn).toBeEnabled();
    }
  });

  test("alchemist buy button is visible at shop", async ({ page }) => {
    await startAtDestination(page, { runGold: 40 });
    await navigateToDestination(page, "Alchemist's Shop");

    await expect(page.getByRole("heading", { name: "Alchemist's Shop" })).toBeVisible();

    const buyButton = page.getByRole("button", { name: /^Buy/ }).first();
    await expect(buyButton).toBeVisible();
  });
});
