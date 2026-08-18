import { expect } from "@playwright/test";
import { test } from "./fixtures/e2e";
import { SAVE_KEY } from "./helpers";
import { MenuPage } from "./pages/menu-page";
import { critical } from "./playwright-tags";

/** Unlocks difficulty-1..N for Knight and Wizard so difficulty cards are selectable. */
async function unlockDifficulties(page: import("@playwright/test").Page, difficultyIds: string[]) {
  await page.addInitScript(
    ({ saveKey, ids }) => {
      const save = JSON.parse(localStorage.getItem(saveKey) || "{}");
      save.completedDifficulties = { knight: [...ids], wizard: [...ids] };
      save.finishedRunCharacters = ["knight", "rogue", "wizard", "ranger", "alchemist", "warlock", "druid"];
      localStorage.setItem(saveKey, JSON.stringify(save));
    },
    { saveKey: SAVE_KEY, ids: difficultyIds },
  );
}

test.describe("Difficulty Select", critical, () => {
  test.beforeEach(async ({ page, runtimeErrors }) => {
    void runtimeErrors;
    await unlockDifficulties(page, ["difficulty-1"]);
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

  test("selecting difficulty enables Play and starts a battle; Back returns to character select", async ({
    page,
    fastBattle,
  }) => {
    void fastBattle;
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

test.describe("Difficulty Skip (first-time player)", critical, () => {
  test("selecting a character with no completed difficulties skips to battle", async ({ page, runtimeErrors }) => {
    void runtimeErrors;
    await page.addInitScript((saveKey) => {
      localStorage.setItem(saveKey, JSON.stringify({ finishedRunCharacters: [] }));
    }, SAVE_KEY);

    const menu = new MenuPage(page);
    await menu.goToCharacterSelect();
    await menu.selectCharacterAndContinue("Knight");

    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 5000 });
  });
});
