// E2E tests for the Wildwood single-boss challenge mode.
import { test, expect } from "@playwright/test";
import { selectGameMode } from "./helpers";

test.describe("Wildwood Mode", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await selectGameMode(page, "wildwood");
  });

  test.afterEach(async ({ page }) => {
    await page.evaluate(() => localStorage.clear()).catch(() => {});
  });

  test("Wildwood button navigates to Character Select", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Choose Your Hero" })).toBeVisible({ timeout: 5000 });
  });

  test("character and boss selection flow", async ({ page }) => {
    // 1. Select character and enter Boss Select Screen
    await page.getByRole("button", { name: "Knight" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "Choose Your Prey" })).toBeVisible({ timeout: 5000 });

    // 2. Verify all 4 boss names are visible
    await expect(page.getByRole("button", { name: "The Forge Golem" })).toBeVisible();
    await expect(page.getByRole("button", { name: "The Frostwarden" })).toBeVisible();
    await expect(page.getByRole("button", { name: "The Blight Treant" })).toBeVisible();
    await expect(page.getByRole("button", { name: "The Iron Bear" })).toBeVisible();
    await expect(page.getByText("Act 1 Boss")).not.toBeVisible();
    await expect(page.getByText("Wildwood Boss")).not.toBeVisible();

    // 3. Hover Iron Bear and verify attacks and traits tooltip
    const ironBear = page.getByRole("button", { name: "The Iron Bear" });
    const tooltip = page.getByTestId("wildwood-boss-tooltip-iron-bear");
    await expect(tooltip).toHaveCSS("opacity", "0");
    await ironBear.hover();
    await expect(tooltip).toHaveCSS("opacity", "1");
    await expect(tooltip).toContainText(/Physical.*damage/);
    await expect(tooltip).toContainText(/Armor/);

    // 4. Test back button returns to character select
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByRole("heading", { name: "Choose Your Hero" })).toBeVisible({ timeout: 5000 });

    // 5. Select boss and click Hunt to start a battle
    await page.getByRole("button", { name: "Knight" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "Choose Your Prey" })).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: "The Iron Bear" }).click();
    await page.getByRole("button", { name: "Hunt" }).click();
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10000 });
  });
});
