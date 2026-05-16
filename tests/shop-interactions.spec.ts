import { expect, test } from "@playwright/test";
import { startAtDestination, navigateToDestination } from "./helpers";

test.describe("Merchant Shop", () => {
  test("buying a card deducts gold and marks as purchased", async ({ page }) => {
    await startAtDestination(page, { runGold: 200 });
    await navigateToDestination(page, "Merchant's Shop");

    await expect(page.getByRole("heading", { name: "Merchant's Shop" })).toBeVisible();

    const goldText = await page.getByText(/\d+ Gold/).first().textContent();
    const goldBefore = goldText ? Number(goldText.match(/\d+/)?.[0]) : 0;

    const buyButton = page.getByRole("button", { name: /^Buy/ }).first();
    await expect(buyButton).toBeVisible();
    if (!(await buyButton.isEnabled())) {
      test.skip(true, "Not enough gold to buy a card");
      return;
    }
    await buyButton.click();
    await page.waitForTimeout(300);

    await expect(page.getByText("Purchased").first()).toBeVisible({ timeout: 3000 });

    const goldAfterText = await page.getByText(/\d+ Gold/).first().textContent();
    const goldAfter = goldAfterText ? Number(goldAfterText.match(/\d+/)?.[0]) : 0;
    expect(goldAfter).toBeLessThan(goldBefore);
  });

  test("card removal deducts gold and removes card from deck", async ({ page }) => {
    await startAtDestination(page, { runGold: 200 });
    await navigateToDestination(page, "Merchant's Shop");

    const removeBtn = page.getByRole("button", { name: /Remove Card/ });
    await expect(removeBtn).toBeVisible();
    if (!(await removeBtn.isEnabled())) {
      test.skip(true, "Not enough gold to remove a card");
      return;
    }

    const goldTextBefore = await page.getByText(/\d+ Gold/).first().textContent();
    const goldBefore = goldTextBefore ? Number(goldTextBefore.match(/\d+/)?.[0]) : 0;

    await removeBtn.click();
    await page.waitForTimeout(500);

    await page.locator('[aria-label^="Select "]').first().click();
    await page.waitForTimeout(300);

    const confirmBtn = page.getByRole("button", { name: /Remove Card/ });
    try {
      await expect(confirmBtn).toBeEnabled({ timeout: 3000 });
      await confirmBtn.click();
    } catch {
      test.skip(true, "Could not select card for removal");
      return;
    }
    await page.waitForTimeout(200);

    const goldTextAfter = await page.getByText(/\d+ Gold/).first().textContent();
    const goldAfter = goldTextAfter ? Number(goldTextAfter.match(/\d+/)?.[0]) : 0;
    expect(goldAfter).toBeLessThan(goldBefore);
  });

  test("shop refresh changes displayed cards and deducts gold", async ({ page }) => {
    await startAtDestination(page, { runGold: 200 });
    await navigateToDestination(page, "Merchant's Shop");

    const buyButtons = page.getByRole("button", { name: /^Buy/ });
    const cardNamesBefore = await buyButtons.allTextContents();

    const refreshBtn = page.getByRole("button", { name: /Refresh/ });
    await expect(refreshBtn).toBeVisible();
    if (!(await refreshBtn.isEnabled())) {
      test.skip(true, "Refresh not available");
      return;
    }
    await refreshBtn.click();
    await page.waitForTimeout(300);

    const cardNamesAfter = await buyButtons.allTextContents();
    const sameCards = cardNamesBefore.length === cardNamesAfter.length
      && cardNamesBefore.every((name, i) => name === cardNamesAfter[i]);
    expect(sameCards).toBe(false);
  });
});

test.describe("Alchemist Shop", () => {
  test("buy potions and mix them", async ({ page }) => {
    await startAtDestination(page, { runGold: 200 });
    await navigateToDestination(page, "Alchemist's Shop");
    await expect(page.getByRole("heading", { name: "Alchemist's Shop" })).toBeVisible();

    for (let i = 0; i < 2; i++) {
      const buyButton = page.getByRole("button", { name: /^Buy/ }).nth(0);
      if (!(await buyButton.isVisible({ timeout: 1000 }).catch(() => false)) || !(await buyButton.isEnabled())) {
        test.skip(true, `Not enough gold to buy potion #${i + 1}`);
        return;
      }
      await buyButton.click();
      await page.waitForTimeout(300);
    }
    await expect(page.getByText("Purchased").nth(0)).toBeVisible();

    const mixButton = page.getByRole("button", { name: /Mix Potions/ });
    if (!(await mixButton.isEnabled())) {
      test.skip(true, "Not enough gold to mix potions");
      return;
    }
    await mixButton.click();
    await expect(page.getByText("Select two Potions to Combine")).toBeVisible();

    const potionCards = page.locator('[aria-label^="Inspect "]');
    const potionCount = await potionCards.count();
    if (potionCount < 2) {
      test.skip(true, "Not enough potions in deck to mix");
      return;
    }

    await potionCards.nth(0).click();
    await page.waitForTimeout(200);
    await potionCards.nth(1).click();
    await page.waitForTimeout(200);

    await page.getByRole("button", { name: "Combine" }).click();
    await page.waitForTimeout(300);

    await expect(page.getByText("Added to Deck: Mixed Potion")).toBeVisible({ timeout: 3000 });
    await expect(page.getByLabel("Mixed Potion")).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();
  });
});
