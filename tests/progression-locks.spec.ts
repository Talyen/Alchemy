import { expect, test } from "./fixtures/e2e";
import { injectHomestead } from "./helpers";
import { MenuPage } from "./pages/menu-page";
import { critical } from "./playwright-tags";

test.describe("Progression Locks", critical, () => {
  test("clean save gates Talents, Homestead, and Armory", critical, async ({ page }) => {
    await injectHomestead(page, { finishedRunCharacters: [] });
    await page.goto("/");

    await expect(page.getByRole("button", { name: "Talents" })).toHaveAttribute("aria-disabled", "true");
    await expect(page.getByRole("button", { name: "Homestead" })).toHaveAttribute("aria-disabled", "true");
    await expect(page.getByRole("button", { name: "Armory" })).toHaveAttribute("aria-disabled", "true");
  });

  test("clean save locks Labyrinth and Wildwood tiles", critical, async ({ page }) => {
    await injectHomestead(page, { finishedRunCharacters: [] });
    const menu = new MenuPage(page);
    await menu.goto();
    await menu.openGameModeSelect();

    await expect(page.getByRole("button", { name: "The Labyrinth (Locked)" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Wildwood Draft (Locked)" })).toBeVisible();
  });

  test("finished Rogue and Ranger unlock Labyrinth and Wildwood tiles", critical, async ({ page }) => {
    await injectHomestead(page, { finishedRunCharacters: ["rogue", "ranger"] });
    const menu = new MenuPage(page);
    await menu.goto();
    await menu.openGameModeSelect();

    await expect(page.getByRole("button", { name: "The Labyrinth", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Wildwood Draft", exact: true })).toBeVisible();
  });
});
