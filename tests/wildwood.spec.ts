// E2E tests for the Wildwood single-boss challenge mode.
import { test, expect } from "@playwright/test";
import { MenuPage } from "./pages/menu-page";
import { critical } from "./playwright-tags";

test.describe("Wildwood Mode", () => {
  test("Wildwood button navigates to Character Select", critical, async ({ page }) => {
    const menu = new MenuPage(page);
    await menu.goToCharacterSelectUnlocked("wildwood", { finishedRunCharacters: ["knight", "rogue", "ranger"] });
  });

  test("character and boss selection flow", async ({ page }) => {
    const menu = new MenuPage(page);
    await menu.goToCharacterSelectUnlocked("wildwood", { finishedRunCharacters: ["knight", "rogue", "ranger"] });

    await menu.selectCharacterAndContinue("Knight");
    await expect(page.getByRole("heading", { name: "Choose Your Prey" })).toBeVisible({ timeout: 5000 });

    await expect(page.getByRole("button", { name: "The Forge Golem" })).toBeVisible();
    await expect(page.getByRole("button", { name: "The Frostwarden" })).toBeVisible();
    await expect(page.getByRole("button", { name: "The Blight Treant" })).toBeVisible();
    await expect(page.getByRole("button", { name: "The Iron Bear" })).toBeVisible();
    await expect(page.getByText("Act 1 Boss")).not.toBeVisible();
    await expect(page.getByText("Wildwood Boss")).not.toBeVisible();

    const ironBear = page.getByRole("button", { name: "The Iron Bear" });
    const tooltip = page.getByTestId("wildwood-boss-tooltip-iron-bear");
    await expect(tooltip).toHaveCSS("opacity", "0");
    await ironBear.hover();
    await expect(tooltip).toHaveCSS("opacity", "1", { timeout: 3000 });
    await expect(tooltip).toContainText(/Physical.*damage/);
    await expect(tooltip).toContainText(/Armor/);

    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByRole("heading", { name: "Choose Your Hero" })).toBeVisible({ timeout: 5000 });

    await menu.selectCharacterAndContinue("Knight");
    await expect(page.getByRole("heading", { name: "Choose Your Prey" })).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: "The Iron Bear" }).click();
    await page.getByRole("button", { name: "Hunt" }).click();
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 5000 });
  });
});
