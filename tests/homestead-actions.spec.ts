import { expect } from "@playwright/test";
import { HomesteadPage } from "./pages/homestead-page";
import { critical } from "./playwright-tags";

test.describe("Homestead Actions", critical, () => {
  test("constructed buildings show their tier status", async ({ page }) => {
    const homestead = new HomesteadPage(page);
    await homestead.goto({
      materialInventory: { wood: 100, iron: 50, herbs: 25, food: 10, crystal: 5 },
      constructedBuildings: { "blacksmiths-forge": 1, carpentry: 0 },
    });

    await expect(homestead.buildingsTab).toBeVisible();
    await expect(homestead.materialPill("Wood", 100)).toBeVisible({ timeout: 3000 });
  });

  test("planted farm plots show planted status", async ({ page }) => {
    const homestead = new HomesteadPage(page);
    await homestead.goto({
      materialInventory: { wood: 100, iron: 50, herbs: 25, food: 10, crystal: 5 },
      plantedFarms: { "herb-garden": 1 },
    });

    await homestead.switchTab("Farm");
    await expect(page.getByRole("button", { name: /Herb Garden/ })).toBeVisible({ timeout: 3000 });
  });

  test("completed research shows in research tab", async ({ page }) => {
    const homestead = new HomesteadPage(page);
    await homestead.goto({
      materialInventory: { wood: 100, iron: 50, herbs: 25, food: 10, crystal: 5 },
      completedResearch: { "botanical-distillation": 1 },
    });

    await homestead.switchTab("Research");
    await expect(page.getByText("Botanical Distillation").first()).toBeVisible({ timeout: 3000 });
  });
});
