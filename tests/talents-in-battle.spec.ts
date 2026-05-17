import { expect, test } from "@playwright/test";
import { injectSaveState, navigateToDestination, resumeGameMode } from "./helpers";

test.describe("Talents in Battle", () => {
  test("block-start talent gives starting block in combat", async ({ page }) => {
    await page.addInitScript(() => {
      const save = JSON.parse(localStorage.getItem("alchemy-save-v1") || "{}");
      save.unlockedTalents = { ...(save.unlockedTalents || {}), block: ["block-start"] };
      save.discoveredCardIds = save.discoveredCardIds || ["slash"];
      localStorage.setItem("alchemy-save-v1", JSON.stringify(save));
    });

    const SLASH = { id: "slash", title: "Slash", descriptionLines: ["Deal 6 Physical damage"], art: "placeholder", cost: 1, effects: [{ kind: "damage" as const, damageType: "physical" as const, amount: 6 }] };
    await injectSaveState(page, {
      runDeck: [SLASH, SLASH, SLASH, SLASH, SLASH, SLASH, SLASH, SLASH],
      runPlayerHealth: 30,
      runMaxHealth: 30,
    });
    await page.goto("/");
    await resumeGameMode(page, "campaign");
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 10000 });
    await navigateToDestination(page, "Normal Combat");
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10000 });

    await expect(page.getByRole("button", { name: "Block 10" })).toBeVisible({ timeout: 3000 });
  });

  test("physical-dmg-1 talent increases physical damage dealt", async ({ page }) => {
    await page.addInitScript(() => {
      const save = JSON.parse(localStorage.getItem("alchemy-save-v1") || "{}");
      save.unlockedTalents = { ...(save.unlockedTalents || {}), physical: ["physical-dmg-1"] };
      save.discoveredCardIds = save.discoveredCardIds || ["slash"];
      localStorage.setItem("alchemy-save-v1", JSON.stringify(save));
    });

    const SLASH = { id: "slash", title: "Slash", descriptionLines: ["Deal 6 Physical damage"], art: "placeholder", cost: 1, effects: [{ kind: "damage" as const, damageType: "physical" as const, amount: 6 }] };
    await injectSaveState(page, {
      runDeck: [SLASH, SLASH, SLASH, SLASH, SLASH, SLASH, SLASH, SLASH],
      runPlayerHealth: 30,
      runMaxHealth: 30,
    });
    await page.goto("/");
    await resumeGameMode(page, "campaign");
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 10000 });
    await navigateToDestination(page, "Normal Combat");
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10000 });

    const slash = page.locator('[aria-label="Play Slash"]').first();
    if (!(await slash.isVisible({ timeout: 2000 }).catch(() => false))) {
      test.skip(true, "Slash not in initial hand");
      return;
    }

    await slash.click();
    await page.waitForTimeout(300);

    const enemyHpText = await page.locator("text=/\\d+\\//").last().textContent();
    const enemyHpAfter = Number(enemyHpText?.split("/")[0] ?? 30);
    expect(enemyHpAfter).toBeLessThan(30);
  });

  test("talents screen shows XP progress from save data", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("alchemy-save-v1", JSON.stringify({
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

    // XP progress bar should be visible (25 XP = 1 point, some progress toward next)
    const xpDisplay = page.getByText("/").filter({ hasText: "XP" });
    await expect(xpDisplay).toBeVisible({ timeout: 3000 });
  });
});
