// E2E tests for the Wildwood single-boss challenge mode.
import { test, expect } from "@playwright/test";
import { selectGameMode } from "./helpers";

test.describe("Wildwood Mode", () => {
  test("Wildwood button navigates to Character Select", async ({ page }) => {
    await page.goto("/");
    await selectGameMode(page, "wildwood");
    await expect(page.getByRole("heading", { name: "Choose Your Hero" })).toBeVisible({ timeout: 5000 });
  });

  test("selecting character shows boss select with 4 bosses", async ({ page }) => {
    await page.goto("/");
    await selectGameMode(page, "wildwood");
    await page.getByRole("button", { name: "Knight" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "Choose Your Prey" })).toBeVisible({ timeout: 5000 });
    // All 4 boss names visible
    await expect(page.getByRole("button", { name: "The Forge Golem" })).toBeVisible();
    await expect(page.getByRole("button", { name: "The Frostwarden" })).toBeVisible();
    await expect(page.getByRole("button", { name: "The Blight Treant" })).toBeVisible();
    await expect(page.getByRole("button", { name: "The Iron Bear" })).toBeVisible();
    await expect(page.getByText("Act 1 Boss")).not.toBeVisible();
    await expect(page.getByText("Wildwood Boss")).not.toBeVisible();
  });

  test("Iron Bear card displays attacks and traits on hover", async ({ page }) => {
    await page.goto("/");
    await selectGameMode(page, "wildwood");
    await page.getByRole("button", { name: "Knight" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    const ironBear = page.getByRole("button", { name: "The Iron Bear" });
    const tooltip = page.getByTestId("wildwood-boss-tooltip-iron-bear");
    await expect(tooltip).toHaveCSS("opacity", "0");
    await ironBear.hover();
    await expect(tooltip).toHaveCSS("opacity", "1");
    await expect(tooltip).toContainText(/Deals 10\s+Physical.*damage/);
    await expect(tooltip).toContainText(/Gains 2\s+Forge.*each turn/);
    await expect(tooltip).toContainText(/Gains 2\s+Armor.*each turn/);
    await expect(tooltip).toContainText(/Receives half\s+Physical.*damage/);
  });

  test("select boss and Hunt starts a battle", async ({ page }) => {
    await page.goto("/");
    await selectGameMode(page, "wildwood");
    await page.getByRole("button", { name: "Knight" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "The Iron Bear" }).click();
    await page.getByRole("button", { name: "Hunt" }).click();
    // Battle screen appears with playable cards
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10000 });
  });

  test("back button from boss select returns to character select", async ({ page }) => {
    await page.goto("/");
    await selectGameMode(page, "wildwood");
    await page.getByRole("button", { name: "Knight" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByRole("heading", { name: "Choose Your Hero" })).toBeVisible({ timeout: 5000 });
  });

  test("Wildwood boss defeat shows game over", async ({ page }) => {
    await page.goto("/");
    await selectGameMode(page, "wildwood");
    await page.getByRole("button", { name: "Knight" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "The Iron Bear" }).click();
    await page.getByRole("button", { name: "Hunt" }).click();

    const defeatHeading = page.getByRole("heading", { name: /Defeat/ });
    for (let turn = 0; turn < 8; turn += 1) {
      if (await defeatHeading.isVisible().catch(() => false)) break;
      await page.getByRole("button", { name: "End Turn" }).click();
      await page.waitForTimeout(1200);
    }
    await expect(page.getByRole("heading", { name: /Defeat/ })).toBeVisible({ timeout: 15000 });
  });
});
