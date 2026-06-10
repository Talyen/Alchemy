import { expect, test } from "@playwright/test";
import { SAVE_KEY } from "./helpers";
import { MenuPage } from "./pages/menu-page";

test.describe("Difficulty Select", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((saveKey) => {
      const save = JSON.parse(localStorage.getItem(saveKey) || "{}");
      save.completedDifficulties = { knight: ["difficulty-1"], wizard: ["difficulty-1"] };
      save.finishedRunCharacters = ["knight", "rogue", "wizard", "ranger", "alchemist", "warlock", "druid"];
      localStorage.setItem(saveKey, JSON.stringify(save));
    }, SAVE_KEY);
  });

  test("difficulty screen shows all three cards with correct unlock states", async ({ page }) => {
    const menu = new MenuPage(page);
    await menu.goToCharacterSelect();
    await menu.selectCharacterAndContinue("Knight");

    await expect(page.getByRole("heading", { name: "A Knight's Journey" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Novice" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Adventurer" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Legend" })).toBeVisible();
    await expect(page.getByText("Locked").first()).toBeVisible();
  });

  test("selecting difficulty enables Play and starts a battle; Back returns to character select", async ({ page }) => {
    const menu = new MenuPage(page);
    await menu.goToCharacterSelect();
    await menu.selectCharacterAndContinue("Knight");

    const playBtn = page.getByRole("button", { name: "Play" }).first();
    await expect(playBtn).toBeDisabled();

    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByRole("heading", { name: "Choose Your Hero" })).toBeVisible();

    await menu.selectCharacterAndContinue("Knight");

    await page.getByRole("button", { name: "Novice" }).click();
    await expect(playBtn).toBeEnabled();
    await playBtn.click();
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 5000 });
  });

  test("Wizard shows different difficulty config", async ({ page }) => {
    const menu = new MenuPage(page);
    await menu.goToCharacterSelect();
    await menu.selectCharacterAndContinue("Wizard");

    await expect(page.getByRole("heading", { name: "A Wizard's Saga" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Novice" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Adventurer" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Legend" })).toBeVisible();
  });
});

test.describe("Difficulty Skip (first-time player)", () => {
  test("selecting a character with no completed difficulties skips to battle", async ({ page }) => {
    await page.addInitScript((saveKey) => {
      localStorage.setItem(saveKey, JSON.stringify({ finishedRunCharacters: [] }));
    }, SAVE_KEY);

    const menu = new MenuPage(page);
    await menu.goToCharacterSelect();
    await menu.selectCharacterAndContinue("Knight");

    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 5000 });
  });
});
