import { expect, test } from "@playwright/test";

test.describe("Homestead Progression", () => {
  test("homestead screen shows injected materials count", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("alchemy-save-v1", JSON.stringify({
        materialInventory: { wood: 100, iron: 50, herbs: 25, food: 10, crystal: 5 },
        constructedBuildings: { "blacksmiths-forge": 0, "hunters-lodge": 0, "alchemy-lab": 0, "placeholder-1": 0, "placeholder-2": 0, "placeholder-3": 0 },
        plantedFarms: { "wheat-field": 0, "herb-garden": 0, "chicken-coop": 0, "pasture": 0, "orchard": 0, "crystal-garden": 0 },
        completedResearch: { "carpentry": 0, "masonry": 0, "crop-rotation": 0, "animal-husbandry": 0, "fortified-walls": 0, "metallurgy": 0 },
        bondedCompanions: { "wolf": 0, "lizard-scout": 0, "imp": 0, "frost-whelp": 0, "bear": 0, "panther": 0, "phoenix": 0 },
        discoveredCardIds: ["slash"],
        encounteredEnemyIds: [],
        discoveredTrinketIds: [],
        talentXP: {},
        unlockedTalents: {},
      }));
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Homestead" }).click();
    await expect(page.getByRole("heading", { name: "Homestead" })).toBeVisible();

    // Materials should display the injected values somewhere on the page
    // The UI shows material items with count badges
    await expect(page.getByText(/100/).first()).toBeVisible({ timeout: 3000 });
  });

  test("homestead buildings tab shows all buildings", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("alchemy-save-v1", JSON.stringify({
        materialInventory: { wood: 999, iron: 999, herbs: 999, food: 999, crystal: 999 },
        constructedBuildings: { "blacksmiths-forge": 0, "hunters-lodge": 0, "alchemy-lab": 0, "placeholder-1": 0, "placeholder-2": 0, "placeholder-3": 0 },
        plantedFarms: { "wheat-field": 0, "herb-garden": 0, "chicken-coop": 0, "pasture": 0, "orchard": 0, "crystal-garden": 0 },
        completedResearch: { "carpentry": 0, "masonry": 0, "crop-rotation": 0, "animal-husbandry": 0, "fortified-walls": 0, "metallurgy": 0 },
        bondedCompanions: { "wolf": 0, "lizard-scout": 0, "imp": 0, "frost-whelp": 0, "bear": 0, "panther": 0, "phoenix": 0 },
        discoveredCardIds: ["slash"],
        encounteredEnemyIds: [],
        discoveredTrinketIds: [],
        talentXP: {},
        unlockedTalents: {},
      }));
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Homestead" }).click();
    await expect(page.getByRole("heading", { name: "Homestead" })).toBeVisible();

    await expect(page.getByRole("button", { name: "Buildings" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Farm" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Research" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Companions" })).toBeVisible();

    // Buildings tab should show Blacksmith's Forge as available
    await expect(page.getByText("Blacksmith").first()).toBeVisible({ timeout: 3000 });
  });

  test("homestead farm tab displays farm plots", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("alchemy-save-v1", JSON.stringify({
        materialInventory: { wood: 999, iron: 999, herbs: 999, food: 999, crystal: 999 },
        constructedBuildings: { "blacksmiths-forge": 0, "hunters-lodge": 0, "alchemy-lab": 0, "placeholder-1": 0, "placeholder-2": 0, "placeholder-3": 0 },
        plantedFarms: { "wheat-field": 0, "herb-garden": 0, "chicken-coop": 0, "pasture": 0, "orchard": 0, "crystal-garden": 0 },
        completedResearch: { "carpentry": 0, "masonry": 0, "crop-rotation": 0, "animal-husbandry": 0, "fortified-walls": 0, "metallurgy": 0 },
        bondedCompanions: { "wolf": 0, "lizard-scout": 0, "imp": 0, "frost-whelp": 0, "bear": 0, "panther": 0, "phoenix": 0 },
        discoveredCardIds: ["slash"],
        encounteredEnemyIds: [],
        discoveredTrinketIds: [],
        talentXP: {},
        unlockedTalents: {},
      }));
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Homestead" }).click();

    await page.getByRole("button", { name: "Farm" }).click();
    await expect(page.getByText("Herb Garden").first()).toBeVisible({ timeout: 3000 });
    await expect(page.getByText("Wheat Field").first()).toBeVisible();
  });
});
