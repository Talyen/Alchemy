import { expect } from "@playwright/test";
import { seedRandom } from "./helpers";
import { BattlePage } from "./pages/battle-page";
import { MenuPage } from "./pages/menu-page";
import { test } from "./fixtures/e2e";

const ENEMY_BASE_HEALTH = 30;

test.describe("Difficulty Modifier Effects", () => {
  test("Novice difficulty has no enemy health modifier", async ({ page, fastBattle }) => {
    void fastBattle;
    await seedRandom(page, 42);
    const menu = new MenuPage(page);
    await menu.goToCharacterSelect();
    await menu.selectCharacterAndContinue("Knight");

    await page.getByRole("button", { name: "Novice" }).click();
    await page.getByRole("button", { name: "Play" }).click();
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 5000 });

    const battle = new BattlePage(page);
    await expect.poll(() => battle.enemyHealth()).toBe(ENEMY_BASE_HEALTH);
  });

  test("Legend difficulty increases enemy health", async ({ page, fastBattle }) => {
    void fastBattle;
    await seedRandom(page, 42);
    const menu = new MenuPage(page);
    await menu.goToCharacterSelectUnlocked();
    await menu.selectCharacterAndContinue("Knight");

    await page.getByRole("button", { name: "Legend" }).click();
    await page.getByRole("button", { name: "Play" }).click();
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 5000 });

    const battle = new BattlePage(page);
    await expect.poll(() => battle.enemyHealth()).toBeGreaterThan(ENEMY_BASE_HEALTH);
  });
});
