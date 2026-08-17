import { expect } from "@playwright/test";
import { makeCard, startBattleWithDeck } from "./helpers";
import { test } from "./fixtures/e2e";
import { MenuPage } from "./pages/menu-page";
import { critical } from "./playwright-tags";

test.describe("Accessibility", critical, () => {
  test("mode and character select screens use proper heading roles", async ({ page }) => {
    const menu = new MenuPage(page);
    await menu.goto();
    await menu.openGameModeSelect();
    await expect(page.getByRole("heading", { name: "Choose Your Adventure" })).toBeVisible({ timeout: 5000 });

    await page.getByRole("button", { name: /The Campaign/ }).click();
    await expect(page.getByRole("heading", { name: "Choose Your Hero" })).toBeVisible({ timeout: 5000 });
  });

  test.describe("battle", () => {
    test.beforeEach(async ({ page, fastBattle, runtimeErrors }) => {
      void fastBattle;
      void runtimeErrors;
      await startBattleWithDeck(
        page,
        Array.from({ length: 6 }, () => makeCard()),
      );
    });

    test("battle cards have accessible play labels", async ({ page }) => {
      const cards = page.locator('[aria-label^="Play "]');
      await expect(cards.first()).toBeVisible({ timeout: 5000 });
      const count = await cards.count();
      expect(count).toBeGreaterThanOrEqual(1);

      const firstLabel = await cards.first().getAttribute("aria-label");
      expect(firstLabel).toMatch(/^Play \w+/);
    });

    test("battle chrome has accessible labels", async ({ page }) => {
      await expect(page.getByLabel("Player hand")).toBeVisible({ timeout: 5000 });
      await expect(page.getByRole("button", { name: "Autoplay" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Open battle menu" })).toBeVisible();
    });
  });
});
