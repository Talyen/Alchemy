import { expect, test } from "@playwright/test";
import { enableFastMode, injectHomestead, injectLabyrinthRun, makeCard, openGameModeSelect, SAVE_KEY, selectGameMode, startBattleWithDeck, startCampaignBattle } from "./helpers";
import { BattlePage } from "./pages/battle-page";
import { MenuPage } from "./pages/menu-page";
import { critical, prepush } from "./playwright-tags";

test.describe("Menu", critical, () => {
  test("main menu reports meta run phase", prepush, async ({ page }) => {
    const menu = new MenuPage(page);
    await menu.goto();
    await menu.expectMainMenu();
    await menu.stage.expectRunPhase("meta");
  });

  test("all menu buttons are visible on the main menu", prepush, async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Collection" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Options" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Talents" })).toBeVisible();
    await openGameModeSelect(page);
    await expect(page.getByRole("button", { name: /The Campaign/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /The Labyrinth/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /The Wildwoods/ })).toBeVisible();
  });

  test("active campaign battle reports battle run phase", async ({ page }) => {
    await startCampaignBattle(page);
    const menu = new MenuPage(page);
    await menu.stage.expectRunPhase("battle");
  });

  test("menu shows Resume Run when a campaign battle is active", async ({ page }) => {
    await startCampaignBattle(page);
    const battle = new BattlePage(page);
    await battle.menuBtn.click();
    await page.getByRole("button", { name: "Main Menu" }).click();
    await openGameModeSelect(page);
    await page.getByRole("button", { name: /The Campaign/ }).click();
    await expect(page.getByRole("button", { name: "Resume" })).toBeVisible();
  });

  test("Labyrinth button shows Resume when a labyrinth run is active", async ({ page }) => {
    await injectLabyrinthRun(page, {
      deck: [makeCard()],
      discoveredCardIds: ["slash", "bash", "block"],
      runOverrides: { roomsEncountered: 1, destinationIndexInAct: 1 },
    });
    await expect(page.getByRole("button", { name: "Resume" })).toBeVisible();
  });
});

test.describe("Character Select", critical, () => {
  test("all characters are selectable and starting run is mapped to localStorage", async ({ page }) => {
    await enableFastMode(page);
    await injectHomestead(page);
    await page.goto("/");
    await selectGameMode(page, "campaign");

    await expect(page.getByRole("heading", { name: "Choose Your Hero" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Knight" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Ranger" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Rogue" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Wizard" })).toBeVisible();

    await page.getByRole("button", { name: "Rogue" }).click({ force: true });
    await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
    await page.getByRole("button", { name: "Wizard" }).click({ force: true });
    await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
    await page.getByRole("button", { name: "Ranger" }).click({ force: true });
    await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();

    // Confirm UI-to-localStorage run startup mapping works for Knight
    await page.getByRole("button", { name: "Knight" }).click({ force: true });
    await page.getByRole("button", { name: "Continue" }).click({ force: true });
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 5000 });

    const saveStateJson = await page.evaluate((saveKey) => localStorage.getItem(saveKey), SAVE_KEY);
    expect(saveStateJson).not.toBeNull();
    const save = JSON.parse(saveStateJson!);
    expect(save.activeRun?.characterId).toBe("knight");
    expect(Array.isArray(save.activeRun?.runDeck)).toBe(true);
  });

  test("back button returns to main menu", async ({ page }) => {
    await page.goto("/");
    await selectGameMode(page, "campaign");
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
  });
});

test.describe("Navigation", () => {
  test("in-battle menu allows navigation to collection, options, and talents", async ({ page }) => {
    await enableFastMode(page);
    await startBattleWithDeck(page, Array.from({ length: 6 }, () => makeCard()));
    const battle = new BattlePage(page);

    await battle.menuBtn.click();

    await expect(page.getByRole("button", { name: "Main Menu" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Collection" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Options" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Talents" })).toBeVisible();
    await expect(page.getByRole("button", { name: "End Turn" })).toBeVisible();
  });
});
