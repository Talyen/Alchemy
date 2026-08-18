import { expect } from "@playwright/test";
import { test } from "./fixtures/e2e";
import { assertHorizontalNeighborGap, SAVE_KEY } from "./helpers";
import { MenuPage } from "./pages/menu-page";
import { critical } from "./playwright-tags";

test.describe("Character Select", critical, () => {
  test.beforeEach(async ({ runtimeErrors }) => {
    void runtimeErrors;
  });

  test("hero portraits keep horizontal gaps between neighbors", async ({ page }) => {
    await new MenuPage(page).goToCharacterSelect();

    await assertHorizontalNeighborGap(page.getByRole("button", { name: /Select |\(Locked\)/ }), { minCount: 4 });
  });

  test("all characters are selectable and starting run is mapped to localStorage", async ({ page }) => {
    const menu = new MenuPage(page);
    await menu.goToCharacterSelectUnlocked();
    await expect(page.getByRole("button", { name: "Select Knight" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Select Ranger" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Select Rogue" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Select Wizard" })).toBeVisible();

    await page.getByRole("button", { name: "Select Knight" }).click();

    await expect
      .poll(
        async () => {
          const saveStateJson = await page.evaluate((saveKey) => localStorage.getItem(saveKey), SAVE_KEY);
          if (!saveStateJson) return null;
          const save = JSON.parse(saveStateJson) as { activeRun?: { characterId?: string; runDeck?: unknown[] } };
          return save.activeRun?.characterId === "knight" && Array.isArray(save.activeRun?.runDeck)
            ? save.activeRun
            : null;
        },
        { timeout: 5000, message: "activeRun should persist knight characterId and runDeck after run start" },
      )
      .not.toBeNull();
  });

  test("screen menu returns to main menu", async ({ page }) => {
    const menu = new MenuPage(page);
    await menu.goToCharacterSelect();
    await page.getByRole("button", { name: "Open character select menu" }).click();
    await page.getByRole("button", { name: "Main Menu" }).click();
    await menu.expectMainMenu();
  });
});
