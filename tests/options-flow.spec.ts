import { expect, test } from "@playwright/test";

test.describe("Options Screen", () => {
  test("all option tabs are accessible and show correct content", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Options" }).click();
    await expect(page.getByRole("heading", { name: "Options" })).toBeVisible();

    await expect(page.getByLabel("Aspect Ratio")).toBeVisible();
    await page.getByRole("button", { name: "Sound" }).click();
    await expect(page.getByText("Music Volume")).toBeVisible();
    await expect(page.getByText("Sound Effects Volume")).toBeVisible();

    await page.getByRole("button", { name: "Other" }).click();
    await expect(page.getByText("Save Data", { exact: true })).toBeVisible();
    await expect(page.getByText("Clear Save Data", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Display" }).click();
    await expect(page.getByLabel("Aspect Ratio")).toBeVisible();
  });

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

    const gameplayTab = page.getByRole("button", { name: "Gameplay" });
    await expect(gameplayTab).toBeVisible({ timeout: 5000 });
    await gameplayTab.click();
    await expect(page.getByText("Auto-End Turn")).toBeVisible({ timeout: 2000 });
  });
});
