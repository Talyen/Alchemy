import { expect, test } from "@playwright/test";
import { startAtDestination } from "./helpers";

test.describe("Merchant Shop", () => {
  test.describe("with sufficient gold", () => {
    test.beforeEach(async ({ page }) => {
      await startAtDestination(page, { runGold: 9999 }, { forceDestination: "Merchant's Shop" });
      await page.getByRole("button", { name: "Merchant's Shop" }).click();
      await expect(page.getByRole("heading", { name: "Merchant's Shop" })).toBeVisible();
    });

    test("buying a card deducts gold and marks as purchased", async ({ page }) => {
      const goldText = await page.getByText(/\d+ Gold/).first().textContent();
      const goldBefore = goldText ? Number(goldText.match(/\d+/)?.[0]) : 0;

      const buyButton = page.getByRole("button", { name: /^Buy/ }).first();
      await expect(buyButton).toBeVisible();
      await expect(buyButton).toBeEnabled();
      await buyButton.click();
      await expect(page.getByText("Purchased").first()).toBeVisible({ timeout: 3000 });

      const goldAfterText = await page.getByText(/\d+ Gold/).first().textContent();
      const goldAfter = goldAfterText ? Number(goldAfterText.match(/\d+/)?.[0]) : 0;
      expect(goldAfter).toBeLessThan(goldBefore);
    });

    test("card removal deducts gold and removes card from deck", async ({ page }) => {
      const removeBtn = page.getByRole("button", { name: /Remove Card/ });
      await expect(removeBtn).toBeVisible();
      await expect(removeBtn).toBeEnabled();

      const goldTextBefore = await page.getByText(/\d+ Gold/).first().textContent();
      const goldBefore = goldTextBefore ? Number(goldTextBefore.match(/\d+/)?.[0]) : 0;

      await removeBtn.click();

      await page.locator('[data-testid="card-selection-grid"] [aria-label^="Select "]').first().click();

      const confirmBtn = page.getByRole("button", { name: /Remove Card/ });
      await expect(confirmBtn).toBeEnabled({ timeout: 3000 });
      await confirmBtn.click();

      const goldTextAfter = await page.getByText(/\d+ Gold/).first().textContent();
      const goldAfter = goldTextAfter ? Number(goldTextAfter.match(/\d+/)?.[0]) : 0;
      expect(goldAfter).toBeLessThan(goldBefore);
    });

    test("shop refresh changes displayed cards and deducts gold", async ({ page }) => {
      const cardButtons = page.locator('button[aria-label^="Inspect "]');
      await expect(cardButtons.first()).toBeVisible();
      const cardNamesBefore = await Promise.all(
        (await cardButtons.all()).map((btn) => btn.getAttribute("aria-label"))
      );
      expect(cardNamesBefore.length).toBeGreaterThan(0);

      const goldTextBefore = await page.getByText(/\d+ Gold/).first().textContent();
      const goldBefore = goldTextBefore ? Number(goldTextBefore.match(/\d+/)?.[0]) : 0;

      const refreshBtn = page.getByRole("button", { name: /Refresh/ });
      await expect(refreshBtn).toBeVisible();
      await expect(refreshBtn).toBeEnabled();
      await refreshBtn.click();

      // Wait until the gold text changes to a smaller value (confirming the refresh happened)
      await expect(async () => {
        const goldTextAfter = await page.getByText(/\d+ Gold/).first().textContent();
        const goldAfter = goldTextAfter ? Number(goldTextAfter.match(/\d+/)?.[0]) : 0;
        expect(goldAfter).toBeLessThan(goldBefore);
      }).toPass({ timeout: 3000 });

      const cardNamesAfter = await Promise.all(
        (await cardButtons.all()).map((btn) => btn.getAttribute("aria-label"))
      );
      const sameCards = cardNamesBefore.length === cardNamesAfter.length
        && cardNamesBefore.every((name, i) => name === cardNamesAfter[i]);
      expect(sameCards).toBe(false);
    });

    test("remove card button is visible with sufficient gold", async ({ page }) => {
      const removeBtn = page.getByRole("button", { name: /Remove Card/ });
      await expect(removeBtn).toBeVisible();
      await expect(removeBtn).toBeEnabled();
    });
  });

  test.describe("with insufficient gold", () => {
    test.beforeEach(async ({ page }) => {
      await startAtDestination(page, { runGold: 40 }, { forceDestination: "Merchant's Shop" });
      await page.getByRole("button", { name: "Merchant's Shop" }).click();
      await expect(page.getByRole("heading", { name: "Merchant's Shop" })).toBeVisible();
    });

    test("buying a card deducts gold and reflects balance", async ({ page }) => {
      const goldTextBefore = await page.getByText(/\d+ Gold/).first().textContent();
      const goldBefore = goldTextBefore ? Number(goldTextBefore.match(/\d+/)?.[0]) : 0;

      const buyButton = page.getByRole("button", { name: /^Buy/ }).first();
      await expect(buyButton).toBeVisible();
      await expect(buyButton).toBeEnabled();
      await buyButton.click();

      await expect(page.getByText("Purchased").first()).toBeVisible({ timeout: 3000 });

      const goldTextAfter = await page.getByText(/\d+ Gold/).first().textContent();
      const goldAfter = goldTextAfter ? Number(goldTextAfter.match(/\d+/)?.[0]) : 0;
      expect(goldAfter).toBeLessThan(goldBefore);
    });
  });
});

test.describe("Alchemist Shop", () => {
  test.describe("with sufficient gold", () => {
    test.beforeEach(async ({ page }) => {
      await startAtDestination(page, { runGold: 9999 }, { forceDestination: "Alchemist's Shop" });
      await page.getByRole("button", { name: "Alchemist's Shop" }).click();
      await expect(page.getByRole("heading", { name: "Alchemist's Shop" })).toBeVisible();
    });

    test("buy potions and mix them", async ({ page }) => {
      for (let i = 0; i < 2; i++) {
        const buyButton = page.getByRole("button", { name: /^Buy/ }).nth(i);
        await expect(buyButton).toBeEnabled({ timeout: 3000 });
        await buyButton.click();
      }
      await expect(page.getByText("Purchased").nth(0)).toBeVisible();

      const mixButton = page.getByRole("button", { name: /Mix Potions/ });
      await expect(mixButton).toBeEnabled();
      await mixButton.click();
      await expect(page.getByText("Select two Potions to Combine")).toBeVisible();

      const selectButtons = page.getByRole("button", { name: /^Select / });
      const potionCount = await selectButtons.count();
      expect(potionCount).toBeGreaterThanOrEqual(2);

      await selectButtons.nth(0).click();
      await selectButtons.nth(1).click();

      await expect(page.getByRole("button", { name: "Combine" })).toBeEnabled({ timeout: 3000 });
      await page.getByRole("button", { name: "Combine" }).click();

      await expect(page.getByText("Added to Deck: Mixed Potion")).toBeVisible({ timeout: 3000 });
      await expect(page.getByLabel("Mixed Potion")).toBeVisible();
      await page.getByRole("button", { name: "Continue" }).click();
    });
  });

  test.describe("with insufficient gold", () => {
    test.beforeEach(async ({ page }) => {
      await startAtDestination(page, { runGold: 40 }, { forceDestination: "Alchemist's Shop" });
      await page.getByRole("button", { name: "Alchemist's Shop" }).click();
      await expect(page.getByRole("heading", { name: "Alchemist's Shop" })).toBeVisible();
    });

    test("buying potions deducts gold and purchased state is shown", async ({ page }) => {
      const goldTextBefore = await page.getByText(/\d+ Gold/).first().textContent();
      const goldBefore = goldTextBefore ? Number(goldTextBefore.match(/\d+/)?.[0]) : 0;

      const buyButton = page.getByRole("button", { name: /^Buy/ }).first();
      await expect(buyButton).toBeVisible();
      await expect(buyButton).toBeEnabled();
      await buyButton.click();
      await expect(page.getByText("Purchased").first()).toBeVisible({ timeout: 3000 });

      const goldTextAfter = await page.getByText(/\d+ Gold/).first().textContent();
      const goldAfter = goldTextAfter ? Number(goldTextAfter.match(/\d+/)?.[0]) : 0;
      expect(goldAfter).toBeLessThan(goldBefore);
    });
  });
});
