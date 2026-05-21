import { expect, test } from "@playwright/test";
import { SAVE_KEY } from "./helpers";

const BASE_SAVE = {
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
};

async function injectHomestead(page: import("@playwright/test").Page, overrides: Record<string, unknown> = {}) {
  await page.addInitScript((data) => {
    const merged = { ...data };
    const KEY = "alchemy-save-v1";
    localStorage.setItem(KEY, JSON.stringify(merged));
  }, { ...BASE_SAVE, ...overrides });
}

test.describe("Homestead Flow", () => {
  test("homestead screen shows injected materials count", async ({ page }) => {
    await injectHomestead(page, {
      materialInventory: { wood: 100, iron: 50, herbs: 25, food: 10, crystal: 5 },
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Homestead" }).click();
    await expect(page.getByRole("heading", { name: "Homestead" })).toBeVisible();
    await expect(page.getByText(/100/).first()).toBeVisible({ timeout: 3000 });
  });

  test("homestead buildings tab shows all buildings", async ({ page }) => {
    await injectHomestead(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Homestead" }).click();
    await expect(page.getByRole("heading", { name: "Homestead" })).toBeVisible();

    await expect(page.getByRole("button", { name: "Buildings" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Farm" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Research" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Companions" })).toBeVisible();

    await expect(page.getByText("Blacksmith").first()).toBeVisible({ timeout: 3000 });
  });

  test("building construction button is visible for blacksmiths forge", async ({ page }) => {
    await injectHomestead(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Homestead" }).click();

    await page.getByRole("button", { name: "Buildings" }).click();
    const constructBtn = page.getByRole("button", { name: /Construct|Build|Upgrade|Craft/ }).first();
    await expect(constructBtn).toBeVisible({ timeout: 3000 });
  });

  test("homestead farm tab displays farm plots", async ({ page }) => {
    await injectHomestead(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Homestead" }).click();

    await page.getByRole("button", { name: "Farm" }).click();
    await expect(page.getByText("Herb Garden").first()).toBeVisible({ timeout: 3000 });
    await expect(page.getByText("Wheat Field").first()).toBeVisible();
  });

  test("research tab shows all research options", async ({ page }) => {
    await injectHomestead(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Homestead" }).click();

    await page.getByRole("button", { name: "Research" }).click();
    await expect(page.getByText("Carpentry").first()).toBeVisible({ timeout: 3000 });
    await expect(page.getByText("Masonry").first()).toBeVisible();
    await expect(page.getByText("Metallurgy").first()).toBeVisible();
  });

  test("companions tab shows companion cards when discovered", async ({ page }) => {
    await injectHomestead(page, {
      discoveredCardIds: ["wolf-companion", "phoenix-companion", "bear-companion", "slash"],
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Homestead" }).click();

    await page.getByRole("button", { name: "Companions" }).click();
    await expect(page.getByText("Wolf").first()).toBeVisible({ timeout: 3000 });
    await expect(page.getByText("Phoenix").first()).toBeVisible();
    await expect(page.getByText("Bear").first()).toBeVisible();
  });
});
