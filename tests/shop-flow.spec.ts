import { expect, test } from "@playwright/test";
import { ShopPage } from "./pages/shop-page";
import { critical, prepush } from "./playwright-tags";

test.describe("Merchant Shop", critical, () => {
  test.describe("with sufficient gold", () => {
    test.beforeEach(async ({ page }) => {
      await new ShopPage(page).enterFromDestination(9999, "Merchant's Shop");
    });

    test("buying a card deducts gold and marks as purchased", prepush, async ({ page }) => {
      const shop = new ShopPage(page);
      await shop.stage.expectRunPhase("runLoop");
      const goldBefore = await shop.gold();

      await shop.buyCard();
      await shop.waitForPurchase();

      expect(await shop.gold()).toBeLessThan(goldBefore);
    });

    test("card removal deducts gold and removes card from deck", async ({ page }) => {
      const shop = new ShopPage(page);
      const goldBefore = await shop.gold();

      await shop.startCardRemoval();
      await shop.selectCardInGrid();
      await shop.confirmRemoval();

      expect(await shop.gold()).toBeLessThan(goldBefore);
    });

    test("shop refresh changes displayed cards and deducts gold", async ({ page }) => {
      const shop = new ShopPage(page);
      await expect(shop.inspectButtons.first()).toBeVisible();
      const cardNamesBefore = await shop.getInspectLabels();
      expect(cardNamesBefore.length).toBeGreaterThan(0);

      const goldBefore = await shop.gold();
      await shop.refresh();

      await expect(async () => {
        expect(await shop.gold()).toBeLessThan(goldBefore);
      }).toPass({ timeout: 3000 });

      const cardNamesAfter = await shop.getInspectLabels();
      const sameCards =
        cardNamesBefore.length === cardNamesAfter.length &&
        cardNamesBefore.every((name, i) => name === cardNamesAfter[i]);
      expect(sameCards).toBe(false);
    });

    test("remove card button is visible with sufficient gold", async ({ page }) => {
      const shop = new ShopPage(page);
      await expect(shop.removeCardBtn).toBeVisible();
      await expect(shop.removeCardBtn).toBeEnabled();
    });
  });

  test.describe("with insufficient gold", () => {
    test.beforeEach(async ({ page }) => {
      await new ShopPage(page).enterFromDestination(40, "Merchant's Shop");
    });

    test("buying a card deducts gold and reflects balance", async ({ page }) => {
      const shop = new ShopPage(page);
      const goldBefore = await shop.gold();

      await shop.buyCard();
      await shop.waitForPurchase();

      expect(await shop.gold()).toBeLessThan(goldBefore);
    });
  });
});

test.describe("Alchemist Shop", () => {
  test.describe("with sufficient gold", () => {
    test.beforeEach(async ({ page }) => {
      await new ShopPage(page).enterFromDestination(9999, "Alchemist's Shop");
    });

    test("buy potions and mix them", async ({ page }) => {
      const shop = new ShopPage(page);

      for (let i = 0; i < 2; i++) {
        await shop.buyCard(i);
      }
      await expect(page.getByText("Purchased").first()).toBeVisible();

      await shop.mixPotions();
      await expect(page.getByLabel("Mixed Potion")).toBeVisible();
      await shop.continueBtn.click();
    });
  });

  test.describe("with insufficient gold", () => {
    test.beforeEach(async ({ page }) => {
      await new ShopPage(page).enterFromDestination(40, "Alchemist's Shop");
    });

    test("buying potions deducts gold and purchased state is shown", async ({ page }) => {
      const shop = new ShopPage(page);
      const goldBefore = await shop.gold();

      await shop.buyCard();
      await shop.waitForPurchase();

      expect(await shop.gold()).toBeLessThan(goldBefore);
    });
  });
});
