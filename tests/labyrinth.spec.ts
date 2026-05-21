import { test, expect } from "@playwright/test";
import { selectGameMode } from "./helpers";

test.describe("Labyrinth Mode", () => {
  test("Labyrinth button navigates to Character Select", async ({ page }) => {
    await page.goto("/");
    await selectGameMode(page, "labyrinth");
    await expect(page.getByRole("heading", { name: "Choose Your Hero" })).toBeVisible({ timeout: 5000 });
  });

  test("selecting character shows labyrinth map screen", async ({ page }) => {
    await page.goto("/");
    await selectGameMode(page, "labyrinth");
    await page.getByRole("button", { name: "Knight" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "Labyrinth" })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Choose your path through the depths")).toBeVisible();
  });

  test("labyrinth map shows entrance and first connected choice", async ({ page }) => {
    await page.goto("/");
    await selectGameMode(page, "labyrinth");
    await page.getByRole("button", { name: "Knight" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "Labyrinth" })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: /Entrance chamber/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Combat chamber.*enterable/ }).first()).toBeVisible();
  });

  test("clicking first connected node in labyrinth enters a battle", async ({ page }) => {
    await page.goto("/");
    await selectGameMode(page, "labyrinth");
    await page.getByRole("button", { name: "Knight" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "Labyrinth" })).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: /Combat chamber.*enterable/ }).first().click();
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10000 });
  });
});
