import { expect, test } from "@playwright/test";
import { enableFastMode, injectHomestead } from "./helpers";

test.describe("Progression Locks", () => {
  test.beforeEach(async ({ page }) => {
    await enableFastMode(page);
  });

  test("clean save gates Talents, Homestead, Armory, Labyrinth, Wildwood, and Rogue class", async ({ page }) => {
    // 1. Inject an empty homestead save where finishedRunCharacters is empty
    await injectHomestead(page, { finishedRunCharacters: [] });
    await page.goto("/");

    // 2. Verify Talents button is locked and shows tooltip on hover
    const talentsBtn = page.getByRole("button", { name: "Talents" });
    await expect(talentsBtn).toBeVisible();
    await expect(talentsBtn).toHaveClass(/(?<!\S)opacity-50(?!\S)/);
    await talentsBtn.hover();
    await expect(page.getByText("Finish a Run as the Knight to unlock")).toBeVisible();

    // Clicking it does not navigate to Talents
    await talentsBtn.click({ force: true });
    await expect(page.getByText("Choose Your Adventure")).not.toBeVisible();
    await expect(page.getByRole("heading", { name: "Talents" })).not.toBeVisible();

    // 3. Verify Homestead button is locked and shows tooltip on hover
    const homesteadBtn = page.getByRole("button", { name: "Homestead" });
    await expect(homesteadBtn).toBeVisible();
    await expect(homesteadBtn).toHaveClass(/(?<!\S)opacity-50(?!\S)/);
    await homesteadBtn.hover();
    await expect(page.getByText("Finish a Run as the Knight to unlock")).toBeVisible();

    // Clicking it does not navigate to Homestead
    await homesteadBtn.click({ force: true });
    await expect(page.getByRole("heading", { name: "Homestead" })).not.toBeVisible();

    // 4. Verify Armory button is locked and shows tooltip on hover
    const armoryBtn = page.getByRole("button", { name: "Armory" });
    await expect(armoryBtn).toBeVisible();
    await expect(armoryBtn).toHaveClass(/(?<!\S)opacity-50(?!\S)/);
    await armoryBtn.hover();
    await expect(page.getByText("Find Gear to unlock")).toBeVisible();

    await armoryBtn.click({ force: true });
    await expect(page.getByRole("heading", { name: "Armory" })).not.toBeVisible();

    // 5. Click Play and verify Labyrinth and Wildwood are locked
    await page.getByRole("button", { name: "Play" }).click();
    await expect(page.getByRole("heading", { name: "Choose Your Adventure" })).toBeVisible();

    const labyrinthCard = page.getByRole("button", { name: /The Labyrinth/ });
    await labyrinthCard.hover();
    await expect(page.getByText("Finish a Run as the Rogue to unlock")).toBeVisible();

    const wildwoodCard = page.getByRole("button", { name: /Wildwood Draft/ });
    await wildwoodCard.hover();
    await expect(page.getByText("Finish a Run as the Ranger to unlock")).toBeVisible();

    // 6. Start Campaign and check character selection screen locks
    await page.getByRole("button", { name: /The Campaign/ }).click();
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Choose Your Hero" })).toBeVisible();

    // Rogue is locked, Knight is unlocked
    const knightCard = page.getByRole("button", { name: "Select Knight" });
    const rogueCard = page.getByRole("button", { name: "Rogue (Locked)" });
    await expect(knightCard).toBeVisible();
    await expect(rogueCard).toBeVisible();

    await rogueCard.hover();
    await expect(page.getByText("Finish a Run as the Knight to unlock")).toBeVisible();

    // Selecting Rogue does not enable Continue
    await rogueCard.click({ force: true });
    await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();

    // Selecting Knight enables Continue
    await knightCard.click();
    await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
  });

  test("finishing run as Knight unlocks Rogue class, Talents, and Homestead", async ({ page }) => {
    // 1. Inject a save where Knight run is completed
    await injectHomestead(page, { finishedRunCharacters: ["knight"] });
    await page.goto("/");

    // 2. Verify Talents and Homestead are unlocked (clicking them navigates)
    const talentsBtn = page.getByRole("button", { name: "Talents" });
    const homesteadBtn = page.getByRole("button", { name: "Homestead" });
    await expect(talentsBtn).not.toHaveClass(/(?<!\S)opacity-50(?!\S)/);
    await expect(homesteadBtn).not.toHaveClass(/(?<!\S)opacity-50(?!\S)/);
    await talentsBtn.click();
    await expect(page.getByRole("heading", { name: "Talents" })).toBeVisible();
    await page.getByRole("button", { name: "Open talents menu" }).click();
    await page.getByRole("button", { name: "Main Menu" }).click();

    await homesteadBtn.click();
    await expect(page.getByRole("heading", { name: "Homestead" })).toBeVisible();
    await page.getByRole("button", { name: "Open homestead menu" }).click();
    await page.getByRole("button", { name: "Main Menu" }).click();

    // 3. Verify Rogue class is unlocked in character select
    await page.getByRole("button", { name: "Play" }).click();
    await page.getByRole("button", { name: /The Campaign/ }).click();
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Choose Your Hero" })).toBeVisible();

    const rogueCard = page.getByRole("button", { name: "Select Rogue" });
    await expect(rogueCard).toBeVisible();
    await rogueCard.click();
    await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();

    // Wizard remains locked
    const wizardCard = page.getByRole("button", { name: "Wizard (Locked)" });
    await expect(wizardCard).toBeVisible();
    await wizardCard.hover();
    await expect(page.getByText("Finish a Run as the Rogue to unlock")).toBeVisible();
  });

  test("finishing run as Rogue unlocks Wizard class and Labyrinth mode", async ({ page }) => {
    // 1. Inject Rogue run completed
    await injectHomestead(page, { finishedRunCharacters: ["knight", "rogue"] });
    await page.goto("/");

    // 2. Verify Labyrinth mode is unlocked
    await page.getByRole("button", { name: "Play" }).click();
    const labyrinthCard = page.getByRole("button", { name: /The Labyrinth/ });
    await expect(labyrinthCard).not.toHaveClass(/(?<!\S)opacity-50(?!\S)/);
    await labyrinthCard.click();
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Choose Your Hero" })).toBeVisible();

    // 3. Verify Wizard class is unlocked
    const wizardCard = page.getByRole("button", { name: "Select Wizard" });
    await expect(wizardCard).toBeVisible();
    await wizardCard.click();
    await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
  });

  test("finishing run as Ranger unlocks Alchemist class and Wildwood mode", async ({ page }) => {
    // 1. Inject Ranger run completed
    await injectHomestead(page, { finishedRunCharacters: ["knight", "rogue", "wizard", "ranger"] });
    await page.goto("/");

    // 2. Verify Wildwood mode is unlocked
    await page.getByRole("button", { name: "Play" }).click();
    const wildwoodCard = page.getByRole("button", { name: /Wildwood Draft/ });
    await expect(wildwoodCard).not.toHaveClass(/(?<!\S)opacity-50(?!\S)/);
    await wildwoodCard.click();
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Choose Your Hero" })).toBeVisible();

    // 3. Verify Alchemist class is unlocked
    const alchemistCard = page.getByRole("button", { name: "Select Alchemist" });
    await expect(alchemistCard).toBeVisible();
    await alchemistCard.click();
    await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
  });
});
