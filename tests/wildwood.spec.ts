// E2E tests for the Wildwood single-boss challenge mode.
import { test, expect } from "@playwright/test";
import { injectSaveState } from "./helpers";

test.describe("Wildwood Mode", () => {
  test("Wildwood button navigates to Character Select", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Wildwood" }).click();
    await expect(page.getByRole("heading", { name: "Choose Your Hero" })).toBeVisible({ timeout: 5000 });
  });

  test("selecting character shows boss select with 4 bosses", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Wildwood" }).click();
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
    await page.getByRole("button", { name: "Wildwood" }).click();
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
    await page.getByRole("button", { name: "Wildwood" }).click();
    await page.getByRole("button", { name: "Knight" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByText("The Iron Bear").click();
    await page.getByRole("button", { name: "Hunt" }).click();
    // Battle screen appears with playable cards
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10000 });
  });

  test("back button from boss select returns to main menu", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Wildwood" }).click();
    await page.getByRole("button", { name: "Knight" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByRole("button", { name: "Campaign" })).toBeVisible({ timeout: 5000 });
  });

  test("Wildwood boss defeat shows game over", async ({ page }) => {
    // Inject a minimal save state, then navigate via Wildwood.
    await injectSaveState(page, {
      characterId: "knight",
      runPlayerHealth: 1,
      runMaxHealth: 30,
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Wildwood" }).click();
    await page.getByRole("button", { name: "Knight" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByText("The Iron Bear").click();
    await page.getByRole("button", { name: "Hunt" }).click();
    // End turn without playing — boss should kill us.
    // First turn: Death's Door triggers.
    await page.getByRole("button", { name: "End Turn" }).click();
    // If Death's Door procs, click End Turn again to die.
    await page.waitForTimeout(2000);
    const endTurnBtn = page.getByRole("button", { name: "End Turn" });
    if (await endTurnBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await endTurnBtn.click();
    }
    await expect(page.getByRole("heading", { name: /Defeat/ })).toBeVisible({ timeout: 15000 });
  });
});
