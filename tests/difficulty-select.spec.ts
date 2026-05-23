import { expect, test } from "@playwright/test";
import { selectGameMode } from "./helpers";

test.describe("Difficulty Select", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const save = JSON.parse(localStorage.getItem("alchemy-save-v1") || "{}");
      save.completedDifficulties = { knight: ["difficulty-1"], wizard: ["difficulty-1"] };
      localStorage.setItem("alchemy-save-v1", JSON.stringify(save));
    });
  });

  test("difficulty screen shows all three cards with correct unlock states", async ({ page }) => {
    await page.goto("/");
    await selectGameMode(page, "campaign");
    await page.getByRole("button", { name: "Knight" }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByRole("heading", { name: "A Knight's Journey" })).toBeVisible();
    await expect(page.getByAltText("Novice")).toBeVisible();
    await expect(page.getByAltText("Adventurer")).toBeVisible();
    await expect(page.getByAltText("Legend")).toBeVisible();
    await expect(page.getByText("Locked").first()).toBeVisible();
  });

  test("selecting difficulty enables Play and starts a battle; Back returns to character select", async ({ page }) => {
    await page.goto("/");
    await selectGameMode(page, "campaign");
    await page.getByRole("button", { name: "Knight" }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    const playBtn = page.getByRole("button", { name: "Play" }).first();
    await expect(playBtn).toBeDisabled();

    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByRole("heading", { name: "Choose Your Hero" })).toBeVisible();

    await page.getByRole("button", { name: "Knight" }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    await page.getByAltText("Novice").click();
    await expect(playBtn).toBeEnabled();
    await playBtn.click();
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 5000 });
  });

  test("Wizard shows different difficulty config", async ({ page }) => {
    await page.goto("/");
    await selectGameMode(page, "campaign");
    await page.getByRole("button", { name: "Wizard" }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByRole("heading", { name: "A Wizard's Saga" })).toBeVisible();
    await expect(page.getByAltText("Novice")).toBeVisible();
    await expect(page.getByAltText("Adventurer")).toBeVisible();
    await expect(page.getByAltText("Legend")).toBeVisible();
  });
});

test.describe("Difficulty Skip (first-time player)", () => {
  test("selecting a character with no completed difficulties skips to battle", async ({ page }) => {
    await page.goto("/");
    await selectGameMode(page, "campaign");
    await page.getByRole("button", { name: "Knight" }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 5000 });
  });
});
