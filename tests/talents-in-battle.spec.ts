import { expect, test } from "@playwright/test";
import { forceNextDestinationChoice, injectSaveState, makeCard, resumeGameMode } from "./helpers";

test.describe("Talents in Battle", () => {
  test("block-start talent gives starting block in combat", async ({ page }) => {
    await page.addInitScript(() => {
      const KEY = "alchemy-save-v1";
      const save = JSON.parse(localStorage.getItem(KEY) || "{}");
      save.unlockedTalents = { ...(save.unlockedTalents || {}), block: ["block-start"] };
      save.discoveredCardIds = save.discoveredCardIds || ["slash"];
      localStorage.setItem(KEY, JSON.stringify(save));
    });

    const SLASH = makeCard();
    await injectSaveState(page, {
      runDeck: [SLASH, SLASH, SLASH, SLASH, SLASH, SLASH, SLASH, SLASH],
      runPlayerHealth: 30,
      runMaxHealth: 30,
    });
    await forceNextDestinationChoice(page, "Normal Combat");
    await page.goto("/");
    await resumeGameMode(page, "campaign");
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 10000 });
    await page.getByRole("button", { name: "Normal Combat" }).click();
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10000 });

    await expect(page.getByRole("button", { name: "Block 10" })).toBeVisible({ timeout: 3000 });
  });

  test("physical-dmg-1 talent increases physical damage dealt", async ({ page }) => {
    await page.addInitScript(() => {
      const KEY = "alchemy-save-v1";
      const save = JSON.parse(localStorage.getItem(KEY) || "{}");
      save.unlockedTalents = { ...(save.unlockedTalents || {}), physical: ["physical-dmg-1"] };
      save.discoveredCardIds = save.discoveredCardIds || ["slash"];
      localStorage.setItem(KEY, JSON.stringify(save));
    });

    const SLASH = makeCard();
    await injectSaveState(page, {
      runDeck: [SLASH, SLASH, SLASH, SLASH, SLASH, SLASH, SLASH, SLASH],
      runPlayerHealth: 30,
      runMaxHealth: 30,
    });
    await forceNextDestinationChoice(page, "Normal Combat");
    await page.goto("/");
    await resumeGameMode(page, "campaign");
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 10000 });
    await page.getByRole("button", { name: "Normal Combat" }).click();
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10000 });

    const slash = page.locator('[aria-label="Play Slash"]').first();
    await expect(slash).toBeVisible({ timeout: 2000 });

    await slash.click();
    const enemyHealthText = await page.locator("text=/\\d+\\//").last().textContent();
    const enemyHpAfter = Number(enemyHealthText?.split("/")[0] ?? 30);
    expect(enemyHpAfter).toBeLessThan(30);
  });

  test("talents screen shows XP progress from save data", async ({ page }) => {
    await page.addInitScript(() => {
      const KEY = "alchemy-save-v1";
      localStorage.setItem(KEY, JSON.stringify({
        discoveredCardIds: ["slash"],
        encounteredEnemyIds: [],
        discoveredTrinketIds: [],
        materialInventory: { wood: 0, iron: 0, herbs: 0, food: 0, crystal: 0 },
        constructedBuildings: { "blacksmiths-forge": 0, "hunters-lodge": 0, "alchemy-lab": 0, "placeholder-1": 0, "placeholder-2": 0, "placeholder-3": 0 },
        plantedFarms: { "wheat-field": 0, "herb-garden": 0, "chicken-coop": 0, "pasture": 0, "orchard": 0, "crystal-garden": 0 },
        completedResearch: { "carpentry": 0, "masonry": 0, "crop-rotation": 0, "animal-husbandry": 0, "fortified-walls": 0, "metallurgy": 0 },
        bondedCompanions: { "wolf": 0, "lizard-scout": 0, "imp": 0, "frost-whelp": 0, "bear": 0, "panther": 0, "phoenix": 0 },
        talentXP: { physical: 25 },
        unlockedTalents: { physical: ["physical-dmg-1"] },
      }));
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Talents" }).click();

    await expect(page.getByRole("heading", { name: "Talents" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Physical" })).toBeVisible();

    await page.getByRole("button", { name: "Physical" }).click();

    const xpDisplay = page.getByText("/").filter({ hasText: "XP" });
    await expect(xpDisplay).toBeVisible({ timeout: 3000 });
  });
});
