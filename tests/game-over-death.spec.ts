import { expect, test } from "@playwright/test";
import { startRun } from "./helpers";

test.describe("Game Over via Death", () => {
  test("taking fatal damage in battle shows game over screen", async ({ page }) => {
    await startRun(page);

    // Use the battle menu's End Run to simulate death
    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("button", { name: "End Run" }).click();

    // Verify game over screen
    await expect(page.getByRole("heading", { name: "Defeat" })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: "Return to Main Menu" })).toBeVisible();

    // Navigate back to main menu
    await page.getByRole("button", { name: "Return to Main Menu" }).click();
    await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
  });
});
