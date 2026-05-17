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
    await expect(page.getByText("The Forge Golem")).toBeVisible();
    await expect(page.getByText("The Frostwarden")).toBeVisible();
    await expect(page.getByText("The Blight Treant")).toBeVisible();
    await expect(page.getByText("The Iron Bear")).toBeVisible();
  });

  test("Iron Bear card displays correct traits", async ({ page }) => {
    await page.goto("/");
    await selectGameMode(page, "wildwood");
    await page.getByRole("button", { name: "Knight" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    // Click Iron Bear to see details
    await page.getByText("The Iron Bear").click();
    await expect(page.getByText("Gains 2 Forge each turn")).toBeVisible();
    await expect(page.getByText("Gains 2 Armor each turn")).toBeVisible();
    await expect(page.getByText("Receives half Physical damage")).toBeVisible();
  });

  test("select boss and Hunt starts a battle", async ({ page }) => {
    await page.goto("/");
    await selectGameMode(page, "wildwood");
    await page.getByRole("button", { name: "Knight" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByText("The Iron Bear").click();
    await page.getByRole("button", { name: "Hunt" }).click();
    // Battle screen appears with playable cards
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10000 });
  });

  test("back button from boss select returns to main menu", async ({ page }) => {
    await page.goto("/");
    await selectGameMode(page, "wildwood");
    await page.getByRole("button", { name: "Knight" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByRole("button", { name: "Play" })).toBeVisible({ timeout: 5000 });
  });

  test("Wildwood boss defeat shows game over", async ({ page }) => {
    await page.goto("/");
    await selectGameMode(page, "wildwood");
    await page.getByRole("button", { name: "Knight" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByText("The Iron Bear").click();
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
