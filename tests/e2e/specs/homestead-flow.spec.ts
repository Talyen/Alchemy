import { expect, test } from "../../fixtures/e2e";
import { HomesteadPage } from "../../pages/homestead-page";
import { MenuPage } from "../../pages/menu-page";
import { controllerInput } from "../controller-input";
import { readSavedGame, withSavedGame } from "../../browser-helpers";
import { critical } from "../../playwright-tags";
import { type Locator } from "@playwright/test";

async function expectNativeArtwork(art: Locator) {
  await expect
    .poll(() =>
      art.evaluate((image) => {
        if (!(image instanceof HTMLImageElement) || !image.naturalWidth) return Infinity;
        const bounds = image.getBoundingClientRect();
        return Math.abs(bounds.width / bounds.height - image.naturalWidth / image.naturalHeight);
      }),
    )
    .toBeLessThan(0.001);
}

test(
  "inspecting never spends; building spends the displayed resources once and survives resume",
  critical,
  async ({ page }) => {
    await new HomesteadPage(page).goto({
      materialInventory: { stone: 4, iron: 11 },
      constructedBuildings: {},
    });
    const input = controllerInput(page);
    await expectNativeArtwork(page.getByRole("img", { name: "Blacksmith", exact: true }));
    const tile = page.getByRole("button", { name: "View Blacksmith, build available" });
    const tooltip = page.getByRole("tooltip", { name: /^Blacksmith/ });
    await tile.hover();
    await expect(tooltip).toContainText("Physical damage +1");
    await page.getByRole("heading", { name: "Homestead" }).hover();
    await expect(tooltip).toBeHidden();
    await input.activate(page.getByRole("button", { name: "View Blacksmith, build available" }));
    await expect(page.getByRole("button", { name: "Inspect Blacksmith benefits" })).toBeVisible();
    await expectNativeArtwork(page.getByRole("img", { name: "Blacksmith", exact: true }));
    await page.getByRole("button", { name: "Inspect Blacksmith benefits" }).focus();
    await expect(tooltip).toContainText("Find more Iron");
    expect((await readSavedGame(page)).materialInventory).toMatchObject({ stone: 4, iron: 11 });
    const buy = page.getByRole("button", { name: "Build Blacksmith for 4 Stone, 11 Iron" });
    await expect(buy).toContainText("4");
    await expect(buy).toContainText("11");
    await expect(buy.locator("img")).toHaveCount(2);
    await buy.click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("button", { name: "Inspect Blacksmith benefits" }).focus();
    await expect(tooltip.getByRole("img", { name: "Level 1 of 4" })).toBeVisible();
    await expect.poll(async () => (await readSavedGame(page)).constructedBuildings["blacksmiths-forge"]).toBe(1);
    await expect.poll(async () => (await readSavedGame(page)).materialInventory).toMatchObject({ stone: 0, iron: 0 });
    await withSavedGame(page, async (resumed) => {
      await new MenuPage(resumed).openHomestead();
      const resumedInput = controllerInput(resumed);
      await resumedInput.activate(resumed.getByRole("button", { name: "View Blacksmith", exact: true }));
      const next = resumed.getByRole("button", { name: "Upgrade Blacksmith for 8 Stone, 22 Iron" });
      await expect(next).toBeDisabled();
      await next.locator("..").focus();
      await expect(resumed.getByRole("tooltip")).toContainText("More materials needed");
      const save = await readSavedGame(resumed);
      expect(save.constructedBuildings["blacksmiths-forge"]).toBe(1);
      expect(save.materialInventory).toMatchObject({ stone: 0, iron: 0 });
    });
  },
);
