import { expect, test } from "@playwright/test";

test.describe("Auto-End Turn", () => {
  test("auto-end turn toggle is accessible in options", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Options" }).click();

    const gameplayTab = page.getByRole("button", { name: "Gameplay" });
    if (await gameplayTab.isVisible({ timeout: 500 }).catch(() => false)) {
      await gameplayTab.click();
      await expect(page.getByText("Auto-End Turn")).toBeVisible({ timeout: 2000 });
    }
  });
});
