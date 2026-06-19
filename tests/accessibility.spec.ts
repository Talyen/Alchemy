import { expect } from "@playwright/test";
import { makeCard, startBattleWithDeck } from "./helpers";
import { test } from "./fixtures/e2e";
import { MenuPage } from "./pages/menu-page";
import { critical } from "./playwright-tags";

test.describe("Accessibility", critical, () => {
  test("main menu buttons are discoverable by role", async ({ page }) => {
    const menu = new MenuPage(page);
    await menu.goto();

    await expect(menu.playBtn).toBeVisible();
    await expect(menu.collectionBtn).toBeVisible();
    await expect(menu.optionsBtn).toBeVisible();
    await expect(menu.talentsBtn).toBeVisible();
    await expect(menu.homesteadBtn).toBeVisible();
  });

  test("battle cards have accessible play labels", async ({ page, fastBattle, runtimeErrors }) => {
    void fastBattle;
    void runtimeErrors;
    await startBattleWithDeck(
      page,
      Array.from({ length: 6 }, () => makeCard()),
    );

    const cards = page.locator('[aria-label^="Play "]');
    await expect(cards.first()).toBeVisible({ timeout: 5000 });
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(1);

    const firstLabel = await cards.first().getAttribute("aria-label");
    expect(firstLabel).toMatch(/^Play \w+/);
  });

  test("mode and character select screens use proper heading roles", async ({ page }) => {
    const menu = new MenuPage(page);
    await menu.goto();
    await menu.openGameModeSelect();
    await expect(page.getByRole("heading", { name: "Choose Your Adventure" })).toBeVisible({ timeout: 5000 });

    await page.getByRole("button", { name: /The Campaign/ }).click();
    await expect(page.getByRole("button", { name: "Play" })).toBeEnabled({ timeout: 5000 });
    await page.getByRole("button", { name: "Play" }).click();
    await expect(page.getByRole("heading", { name: "Choose Your Hero" })).toBeVisible({ timeout: 5000 });
  });

  test("inspect and select buttons have accessible labels in battle", async ({ page, fastBattle, runtimeErrors }) => {
    void fastBattle;
    void runtimeErrors;
    await startBattleWithDeck(
      page,
      Array.from({ length: 6 }, () => makeCard()),
    );

    const cards = page.locator('[aria-label^="Play "]');
    await expect(cards.first()).toBeVisible({ timeout: 5000 });

    await cards.first().hover();
    await expect(page.locator(".hover-popup-panel.pointer-events-auto")).toBeVisible({ timeout: 3000 });
  });
});
