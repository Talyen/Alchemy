import type { Locator } from "@playwright/test";
import { expect, test } from "./fixtures/e2e";
import { HomesteadPage } from "./pages/homestead-page";

test.describe("Homestead Flow", () => {
  test.describe("with custom materials", () => {
    test.beforeEach(async ({ page }) => {
      await new HomesteadPage(page).goto({
        materialInventory: { wood: 100, iron: 50, herbs: 25, food: 10, crystal: 5 },
      });
    });

    test("homestead screen shows injected materials count", async ({ page }) => {
      const homestead = new HomesteadPage(page);
      await expect(homestead.materialPill("Wood", 100)).toBeVisible({ timeout: 3000 });
      await expect(homestead.materialPill("Iron", 50)).toBeVisible({ timeout: 3000 });
    });
  });

  test.describe("with default homestead", () => {
    test.beforeEach(async ({ page }) => {
      await new HomesteadPage(page).goto();
    });

    test("homestead buildings tab shows all buildings", async ({ page }) => {
      const homestead = new HomesteadPage(page);
      await expect(homestead.buildingsTab).toBeVisible();
      await expect(homestead.farmTab).toBeVisible();
      await expect(homestead.researchTab).toBeVisible();
      await expect(homestead.companionsTab).toBeVisible();

      await expect(page.getByText("Blacksmith").first()).toBeVisible({ timeout: 3000 });
    });

    test("building construction button is visible for blacksmiths forge", async ({ page }) => {
      const homestead = new HomesteadPage(page);
      await homestead.switchTab("Buildings");
      await expect(await homestead.constructButton()).toBeVisible({ timeout: 3000 });
    });

    test("homestead farm tab displays visible farm plots", async ({ page }) => {
      const homestead = new HomesteadPage(page);
      await homestead.switchTab("Farm");
      await expect(page.getByRole("button", { name: /Herb Garden/ })).toBeVisible({ timeout: 3000 });
      await expect(page.getByRole("img", { name: "Herb Garden" })).toBeVisible();
      await expect(page.getByRole("button", { name: /Wheat Field/ })).toBeVisible();
    });

    test("research tab shows all research options", async ({ page }) => {
      const homestead = new HomesteadPage(page);
      await homestead.switchTab("Research");
      await expect(page.getByText("Leyline Energy").first()).toBeVisible({ timeout: 3000 });
      await expect(page.getByText("Detect Magic").first()).toBeVisible();
      await expect(page.getByText("Agility Training").first()).toBeVisible();
    });
  });

  test.describe("with custom companions", () => {
    test.beforeEach(async ({ page }) => {
      await new HomesteadPage(page).goto({
        discoveredCardIds: ["wolf-companion", "phoenix-companion", "bear-companion", "slash"],
      });
    });

    test("companions tab shows companion cards when discovered", async ({ page }) => {
      const homestead = new HomesteadPage(page);
      await homestead.switchTab("Companions");
      await expect(page.getByText("Wolf").first()).toBeVisible({ timeout: 3000 });
      await expect(page.getByText("Phoenix").first()).toBeVisible();
      await expect(page.getByText("Bear").first()).toBeVisible();
    });
  });

  test.describe("Homestead Actions", () => {
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

  test.describe("Homestead Layout", () => {
    let homestead: HomesteadPage;

    test.beforeEach(async ({ page }) => {
      homestead = new HomesteadPage(page);
      await homestead.goto();
    });

    test("homestead shell does not resize when switching between tabs", async ({ page }) => {
      const shell = page.locator(".alchemy-shell").first();
      const heights: number[] = [];
      const tabAnchors: Record<"Buildings" | "Farm" | "Research" | "Companions", Locator> = {
        Buildings: page.getByText("Blacksmith").first(),
        Farm: page.getByRole("button", { name: /Herb Garden/ }),
        Research: page.getByText("Leyline Energy").first(),
        Companions: page.getByText("Undiscovered").first(),
      };

      for (const tab of ["Buildings", "Farm", "Research", "Companions"] as const) {
        await homestead.switchTab(tab);
        await expect(tabAnchors[tab]).toBeVisible({ timeout: 3000 });
        const box = await shell.boundingBox();
        expect(box).not.toBeNull();
        heights.push(box!.height);
      }

      const max = Math.max(...heights);
      const min = Math.min(...heights);
      expect(max - min).toBeLessThanOrEqual(1);
    });
  });
});
