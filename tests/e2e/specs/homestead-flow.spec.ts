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

// Real pointer transfer, portaled focus order, and persisted purchase feedback share one journey.
test("gallery hover purchases preserve focus, spend once, and survive resume", critical, async ({ page }) => {
  await new HomesteadPage(page).goto({ materialInventory: { stone: 4, iron: 11 }, constructedBuildings: {} });
  const art = page.getByRole("img", { name: "Blacksmith", exact: true });
  await expectNativeArtwork(art);
  const heading = page.getByRole("heading", { name: "Homestead" });
  const headingBefore = await heading.boundingBox();
  const tile = page.getByRole("button", { name: "View Blacksmith, build available" });
  const panel = page.getByRole("dialog", { name: "Blacksmith", exact: true });
  await tile.hover();
  await expect(panel).toBeVisible();
  await expect(panel).not.toContainText("Physical damage");
  await expect(panel).not.toContainText("Find");
  const buy = panel.getByRole("button", { name: "Build Blacksmith for 4 Stone, 11 Iron" });
  await buy.hover();
  await expect(panel).toBeVisible();
  await heading.hover();
  await expect(panel).toBeHidden();
  await tile.focus();
  await page.keyboard.press("Tab");
  await expect(buy).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(tile).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(tile).toBeFocused();
  await tile.click();
  await expect(panel).toBeVisible();
  expect((await readSavedGame(page)).materialInventory).toMatchObject({ stone: 4, iron: 11 });
  await expect(buy.locator("img")).toHaveCount(2);
  await buy.click();
  await expect(panel.getByRole("img", { name: "Level 1 of 4" })).toBeVisible();
  await expect(panel).toContainText("Physical damage is increased by 1");
  await expect(panel).toContainText("Find 10% more");
  await expect(panel.getByRole("button", { name: "Upgrade Blacksmith for 8 Stone, 22 Iron" })).toBeDisabled();
  await expect(art).not.toHaveClass(/grayscale/);
  await expectNativeArtwork(art);
  expect(await heading.boundingBox()).toEqual(headingBefore);
  await expect.poll(async () => (await readSavedGame(page)).constructedBuildings["blacksmiths-forge"]).toBe(1);
  await expect.poll(async () => (await readSavedGame(page)).materialInventory).toMatchObject({ stone: 0, iron: 0 });
  await withSavedGame(page, async (resumed) => {
    await new MenuPage(resumed).openHomestead();
    await resumed.getByRole("button", { name: "View Blacksmith", exact: true }).focus();
    const inspection = resumed.getByRole("dialog", { name: "Blacksmith", exact: true });
    await expect(inspection).toContainText("Physical damage is increased by 1");
    await expect(inspection.getByRole("button", { name: "Upgrade Blacksmith for 8 Stone, 22 Iron" })).toBeDisabled();
    await expect(inspection).toContainText("More materials needed");
    const save = await readSavedGame(resumed);
    expect(save.constructedBuildings["blacksmiths-forge"]).toBe(1);
    expect(save.materialInventory).toMatchObject({ stone: 0, iron: 0 });
  });
});
