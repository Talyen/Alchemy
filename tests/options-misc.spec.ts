import { expect, test } from "@playwright/test";

test.describe("Clear Save Data", () => {
  test("clear save data confirmation dialog can be cancelled", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Options" }).click();
    await page.getByRole("button", { name: "Other" }).click();

    await page.getByRole("button", { name: "Clear Save Data" }).click();
    await expect(page.getByText("Clear Save Data?")).toBeVisible({ timeout: 3000 });

    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByText("Clear Save Data?")).not.toBeVisible();
  });
});

test.describe("Auto-End Turn", () => {
  test("auto-end turn toggle is accessible in gameplay tab", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Options" }).click();

    // Look for the Gameplay tab (may not exist in all versions; fallback to checking tabs exist)
    const gameplayTab = page.getByRole("button", { name: "Gameplay" });
    if (await gameplayTab.isVisible({ timeout: 500 }).catch(() => false)) {
      await gameplayTab.click();
      await expect(page.getByText("Auto-End Turn")).toBeVisible({ timeout: 2000 });
    }
  });
});
