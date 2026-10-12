import { expect, test } from "../../fixtures/e2e";
import { HomesteadPage } from "../../pages/homestead-page";
import { MenuPage } from "../../pages/menu-page";
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

// Native pointer/focus behavior and acknowledged persistence share one gallery journey.
test(
  "gallery node purchases preserve passive inspection, spend once, and survive resume",
  critical,
  async ({ page }) => {
    await new HomesteadPage(page).goto({ materialInventory: { stone: 4, iron: 11 }, constructedBuildings: {} });
    const art = page.getByRole("img", { name: "Blacksmith", exact: true });
    await expectNativeArtwork(art);
    const heading = page.getByRole("heading", { name: "Homestead" });
    const headingBefore = await heading.boundingBox();
    const tile = page.getByRole("button").filter({ has: art });
    const panel = page.getByRole("tooltip").filter({ has: page.getByText("Blacksmith", { exact: true }) });
    await expect(tile).toHaveClass(/homestead-node-affordable/);
    await expect(tile).toHaveCSS("filter", /drop-shadow/);
    const affordableFilter = await tile.evaluate((element) => getComputedStyle(element).filter);
    await tile.hover();
    await expect(panel).toBeVisible();
    await expect(panel).toContainText("Physical damage is increased by 1");
    await expect(panel).toContainText("Find 10% more");
    await expect(panel.locator(".grayscale")).toHaveCSS("opacity", "0.6");
    await expect(panel.getByRole("img", { name: "Level 0 of 4" })).toBeVisible();
    await expect(panel.getByLabel("Build cost: 4 Stone, 11 Iron").locator("img")).toHaveCount(2);
    await expect(panel.getByRole("button")).toHaveCount(0);
    await expect(tile).toHaveCSS("scale", "1.035");
    await expect(tile).toHaveCSS("filter", affordableFilter);
    await expect.poll(() => tile.evaluate((element) => getComputedStyle(element, "::after").borderWidth)).toBe("3px");
    expect((await readSavedGame(page)).materialInventory).toMatchObject({ stone: 4, iron: 11 });
    await heading.hover();
    await expect(panel).toBeHidden();
    await tile.focus();
    await expect(panel).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: /^Build Hunter's Lodge for / })).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(tile).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(panel.getByRole("img", { name: "Level 1 of 4" })).toBeVisible();
    await expect(panel).toContainText("Physical damage is increased by 1");
    await expect(panel).toContainText("Find 10% more");
    await expect(panel.locator(".grayscale")).toHaveCount(0);
    await expect(tile).toHaveAttribute("aria-label", "Upgrade Blacksmith for 8 Stone, 22 Iron");
    await expect(tile).toHaveAttribute("aria-disabled", "true");
    await expect(tile).not.toHaveClass(/homestead-node-affordable/);
    await expect(tile).toHaveCSS("filter", "none");
    await expect(art).not.toHaveClass(/grayscale/);
    await expectNativeArtwork(art);
    expect(await heading.boundingBox()).toEqual(headingBefore);
    await page.keyboard.press("Enter");
    await expect.poll(async () => (await readSavedGame(page)).constructedBuildings["blacksmiths-forge"]).toBe(1);
    await expect.poll(async () => (await readSavedGame(page)).materialInventory).toMatchObject({ stone: 0, iron: 0 });
    await withSavedGame(page, async (resumed) => {
      await new MenuPage(resumed).openHomestead();
      const resumedTile = resumed.getByRole("button", { name: "Upgrade Blacksmith for 8 Stone, 22 Iron", exact: true });
      await resumedTile.focus();
      const inspection = resumed.getByRole("tooltip").filter({ has: resumed.getByText("Blacksmith", { exact: true }) });
      await expect(inspection).toContainText("Physical damage is increased by 1");
      await expect(inspection.getByRole("button")).toHaveCount(0);
      await expect(inspection).toContainText("More materials needed");
      await expect(resumedTile).toHaveAttribute("aria-disabled", "true");
      await expect(resumedTile).not.toHaveClass(/homestead-node-affordable/);
      await expect(resumed.getByRole("img", { name: "Blacksmith", exact: true })).not.toHaveClass(/grayscale/);
      const save = await readSavedGame(resumed);
      expect(save.constructedBuildings["blacksmiths-forge"]).toBe(1);
      expect(save.materialInventory).toMatchObject({ stone: 0, iron: 0 });
    });
  },
);
