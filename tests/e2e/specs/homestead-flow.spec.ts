import { expect, test } from "../../fixtures/e2e";
import { HomesteadPage } from "../../pages/homestead-page";
import { critical } from "../../playwright-tags";
import { waitForLayoutSettled } from "../../browser-helpers";

test.describe("Homestead Flow", () => {
  // Material pills and companion pagination live in homestead-screen.test.tsx;
  // the browser checks injected state and actual page centering below.
  test.describe("Homestead Actions", () => {
    test("buildings, farms, and research show injected state", critical, async ({ page }) => {
      const homestead = new HomesteadPage(page);

      await homestead.goto({
        materialInventory: { wood: 100, iron: 50, herbs: 25, food: 10, gems: 5 },
        constructedBuildings: { "blacksmiths-forge": 1 },
      });
      await expect(homestead.buildingsTab).toBeVisible();
      await expect(homestead.materialPill("Wood", 100)).toBeVisible({ timeout: 3000 });

      await homestead.goto({
        materialInventory: { wood: 100, iron: 50, herbs: 25, food: 10, gems: 5 },
        plantedFarms: { "herb-garden": 1 },
      });
      await homestead.switchTab("Farm");
      await expect(page.getByRole("button", { name: /Herb Garden/ })).toBeVisible({ timeout: 3000 });

      await homestead.goto({
        materialInventory: { wood: 100, iron: 50, herbs: 25, food: 10, gems: 5 },
        completedResearch: { "botanical-distillation": 1 },
      });
      await homestead.switchTab("Research");
      await expect(page.getByRole("button", { name: /Botanical Distillation/ }).first()).toBeVisible({ timeout: 3000 });
    });
  });

  test.describe("Homestead Layout", () => {
    let homestead: HomesteadPage;

    test.beforeEach(async ({ page }) => {
      homestead = new HomesteadPage(page);
      await homestead.goto();
    });

    test("Homestead centers each tab by its actual content and omits single-page pagination", async ({ page }) => {
      await page.setViewportSize({ width: 1470, height: 956 });
      const shell = page.locator(".max-w-7xl").first();
      for (const tab of ["Buildings", "Farm", "Research", "Companions"] as const) {
        await homestead.switchTab(tab);
        await waitForLayoutSettled(page, homestead.heading);
        const bounds = await shell.boundingBox();
        expect(bounds).not.toBeNull();
        expect(Math.abs(bounds!.y + bounds!.height / 2 - 956 / 2)).toBeLessThan(2);
        if (tab === "Farm" || tab === "Research") {
          await expect(page.getByRole("button", { name: "Next page", exact: true })).toHaveCount(0);
        }
      }
      await homestead.switchTab("Buildings");
      await waitForLayoutSettled(page, page.getByRole("button", { name: /Blacksmith/ }).first());
      await expect(page.getByRole("button", { name: "Next page", exact: true })).toBeEnabled();
      await homestead.switchTab("Farm");
      await expect(page.getByRole("button", { name: /Wheat Field/ })).toBeVisible();
      await homestead.switchTab("Research");
      await expect(page.getByRole("button", { name: /Detect Magic/ }).first()).toBeVisible();
      await expect(page.getByRole("button", { name: /Agility Training/ }).first()).toBeVisible();
    });
  });
});
