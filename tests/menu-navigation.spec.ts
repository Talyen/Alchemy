import { expect, test } from "@playwright/test";
import { createMinimalLabyrinthMap, makeCard, openGameModeSelect, selectGameMode, startCampaignBattle } from "./helpers";
import { BattlePage } from "./pages/battle-page";

test.describe("Menu", () => {
  test.afterEach(async ({ page }) => {
    await page.evaluate(() => localStorage.clear()).catch(() => {});
  });

  test("all menu buttons are visible on the main menu", async ({ page }) => {
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
    const map = createMinimalLabyrinthMap();
    const card = makeCard();

    await page.addInitScript((data) => {
      const KEY = "alchemy-save-v1";
      const save = JSON.parse(localStorage.getItem(KEY) || "{}");
      save.activeRun = {
        characterId: "knight",
        runDeck: [data.card],
        runGold: 0, runPlayerHealth: 30, runMaxHealth: 30, roomsEncountered: 1,
        currentAct: 1, destinationIndexInAct: 1, completedDestinations: [],
        runTrinkets: [], selectedDifficulty: null,
        contentSystemType: "labyrinth", labyrinthMap: data.map,
      };
      if (!Array.isArray(save.discoveredCardIds) || save.discoveredCardIds.length === 0) {
        save.discoveredCardIds = ["slash", "bash", "block"];
      }
      localStorage.setItem(KEY, JSON.stringify(save));
    }, { map, card });

    await page.goto("/");
    await openGameModeSelect(page);
    await page.getByRole("button", { name: /The Labyrinth/ }).click();
    await expect(page.getByRole("button", { name: "Resume" })).toBeVisible();
  });
});

test.describe("Character Select", () => {
  test.afterEach(async ({ page }) => {
    await page.evaluate(() => localStorage.clear()).catch(() => {});
  });

  test("all characters are selectable and starting run is mapped to localStorage", async ({ page }) => {
    await page.goto("/");
    await selectGameMode(page, "campaign");

    await expect(page.getByRole("heading", { name: "Choose Your Hero" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Knight" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Ranger" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Rogue" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Wizard" })).toBeVisible();

    await page.getByRole("button", { name: "Rogue" }).click();
    await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
    await page.getByRole("button", { name: "Wizard" }).click();
    await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
    await page.getByRole("button", { name: "Ranger" }).click();
    await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();

    // Confirm UI-to-localStorage run startup mapping works for Knight
    await page.getByRole("button", { name: "Knight" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10000 });

    const saveStateJson = await page.evaluate(() => localStorage.getItem("alchemy-save-v1"));
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
  test.afterEach(async ({ page }) => {
    await page.evaluate(() => localStorage.clear()).catch(() => {});
  });

  test("in-battle menu allows navigation to collection, options, and talents", async ({ page }) => {
    await startCampaignBattle(page);
    const battle = new BattlePage(page);

    await battle.menuBtn.click();

    await expect(page.getByRole("button", { name: "Main Menu" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Collection" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Options" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Talents" })).toBeVisible();
    await expect(page.getByRole("button", { name: "End Turn" })).toBeVisible();
  });
});
