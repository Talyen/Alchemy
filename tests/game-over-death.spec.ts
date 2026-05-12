import { expect, test } from "@playwright/test";
import { injectSaveState, startRun } from "./helpers";

test.describe("Game Over via Death", () => {
  test("taking fatal damage in battle shows game over screen", async ({ page }) => {
    await startRun(page);
    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("button", { name: "End Run" }).click();
    await expect(page.getByRole("heading", { name: "Defeat" })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: "Return to Main Menu" })).toBeVisible();
    await page.getByRole("button", { name: "Return to Main Menu" }).click();
    await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
  });

  test("natural death via HP depletion from enemy damage", async ({ page }) => {
    await injectSaveState(page, {
      runPlayerHealth: 1,
      runMaxHealth: 30,
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Resume Run" }).click();

    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 10000 });
    await page.getByRole("button", { name: /Combat/ }).first().click();
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10000 });

    await page.getByRole("button", { name: "End Turn" }).click();
    await expect(page.getByRole("heading", { name: "Defeat" })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("button", { name: "Return to Main Menu" })).toBeVisible();
  });
});
