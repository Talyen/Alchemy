import { expect, test } from "@playwright/test";
import { failOnRuntimeErrors, SAVE_KEY } from "./helpers";
import { MenuPage } from "./pages/menu-page";

test.describe("Save Error Paths", () => {
  test("corrupted JSON in localStorage falls back to defaults gracefully", async ({ page }) => {
    await page.addInitScript((saveKey) => {
      localStorage.setItem(saveKey, "not-valid-json{{{");
    }, SAVE_KEY);
    await page.goto("/");
    await new MenuPage(page).expectMainMenu();
  });

  test("missing save key still shows main menu", async ({ page }) => {
    await page.addInitScript((saveKey) => {
      localStorage.removeItem(saveKey);
    }, SAVE_KEY);
    await page.goto("/");
    const menu = new MenuPage(page);
    await menu.expectMainMenu();
    await expect(menu.collectionBtn).toBeVisible();
    await expect(menu.optionsBtn).toBeVisible();
  });

  test("save with null activeRun does not crash", async ({ page }) => {
    await page.addInitScript((saveKey) => {
      localStorage.setItem(saveKey, JSON.stringify({
        materialInventory: {},
        activeRun: null,
        discoveredCardIds: [],
        encounteredEnemyIds: [],
        discoveredTrinketIds: [],
        talentXP: {},
        unlockedTalents: {},
      }));
    }, SAVE_KEY);
    await page.goto("/");
    await new MenuPage(page).expectMainMenu();
  });

  test("empty save object does not crash", async ({ page }) => {
    await page.addInitScript((saveKey) => {
      localStorage.setItem(saveKey, JSON.stringify({}));
    }, SAVE_KEY);
    await page.goto("/");
    await new MenuPage(page).expectMainMenu();
  });

  test("fresh localStorage shows main menu without errors", async ({ page }) => {
    const errors = failOnRuntimeErrors(page);

    await page.addInitScript(() => {
      localStorage.clear();
      localStorage.removeItem("alchemy-skip-loading-screen");
    });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await new MenuPage(page).expectMainMenu();

    expect(errors).toEqual([]);
  });
});
