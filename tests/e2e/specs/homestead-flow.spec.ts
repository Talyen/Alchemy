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
  "inspecting never spends; building spends the quoted resources once and survives resume",
  critical,
  async ({ page }) => {
    await new HomesteadPage(page).goto({
      materialInventory: { stone: 4, iron: 11 },
      constructedBuildings: {},
    });
    const input = controllerInput(page);
    await expectNativeArtwork(page.getByRole("img", { name: "Blacksmith", exact: true }));
    await input.activate(page.getByRole("button", { name: "View Blacksmith, build available" }));
    await expect(page.getByRole("heading", { name: "Blacksmith" })).toBeVisible();
    await expectNativeArtwork(page.getByRole("img", { name: "Blacksmith", exact: true }));
    expect((await readSavedGame(page)).materialInventory).toMatchObject({ stone: 4, iron: 11 });
    await input.activate(page.getByRole("button", { name: "Review build for Blacksmith" }));
    const sheet = page.getByRole("dialog", { name: "Blacksmith" });
    await expect(sheet).toContainText("4");
    await expect(sheet).toContainText("11");
    await sheet.getByRole("button", { name: "Build", exact: true }).click();
    await expect(sheet).toBeHidden();
    await expect(page.getByRole("progressbar", { name: "Upgrade progress" })).toHaveAttribute("aria-valuenow", "1");
    await expect.poll(async () => (await readSavedGame(page)).constructedBuildings["blacksmiths-forge"]).toBe(1);
    await expect.poll(async () => (await readSavedGame(page)).materialInventory).toMatchObject({ stone: 0, iron: 0 });
    await withSavedGame(page, async (resumed) => {
      await new MenuPage(resumed).openHomestead();
      const resumedInput = controllerInput(resumed);
      await resumedInput.activate(resumed.getByRole("button", { name: "View Blacksmith", exact: true }));
      await resumedInput.activate(resumed.getByRole("button", { name: "Review upgrade for Blacksmith" }));
      const next = resumed.getByRole("dialog", { name: "Blacksmith" });
      await expect(next.getByRole("button", { name: "Upgrade", exact: true })).toBeDisabled();
      await expect(next).toContainText("More materials needed");
      const save = await readSavedGame(resumed);
      expect(save.constructedBuildings["blacksmiths-forge"]).toBe(1);
      expect(save.materialInventory).toMatchObject({ stone: 0, iron: 0 });
    });
  },
);
