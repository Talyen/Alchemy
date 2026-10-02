import { expect, test } from "../../fixtures/e2e";
import { HomesteadPage } from "../../pages/homestead-page";
import { MenuPage } from "../../pages/menu-page";
import { controllerInput } from "../controller-input";
import { readSavedGame, withSavedGame } from "../../browser-helpers";
import { critical } from "../../playwright-tags";

test("building spends the quoted resources once and survives resume", critical, async ({ page }) => {
  await new HomesteadPage(page).goto({
    materialInventory: { stone: 8, iron: 22 },
    constructedBuildings: {},
  });
  const build = page.getByRole("button", { name: /^Build Blacksmith,/ });
  await expect(build).toHaveAttribute("aria-label", /8 Stone/);
  await expect(build).toHaveAttribute("aria-label", /22 Iron/);
  await controllerInput(page).activate(build);
  await expect.poll(async () => (await readSavedGame(page)).constructedBuildings["blacksmiths-forge"]).toBe(1);
  await expect.poll(async () => (await readSavedGame(page)).materialInventory).toMatchObject({ stone: 0, iron: 0 });
  await withSavedGame(page, async (resumed) => {
    await new MenuPage(resumed).openHomestead();
    await expect(resumed.getByRole("button", { name: /^Upgrade Blacksmith, level 1/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    const save = await readSavedGame(resumed);
    expect(save.constructedBuildings["blacksmiths-forge"]).toBe(1);
    expect(save.materialInventory).toMatchObject({ stone: 0, iron: 0 });
  });
});
