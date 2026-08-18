import { expect, test } from "./fixtures/e2e";
import { injectHomestead } from "./helpers";
import { critical } from "./playwright-tags";

test.describe("Progression Locks", () => {
  test.beforeEach(async ({ fastBattle, runtimeErrors }) => {
    void runtimeErrors;
    void fastBattle;
  });

  test(
    "clean save gates Talents, Homestead, Armory, Labyrinth, Wildwood, and Rogue class",
    critical,
    async ({ page }) => {
      // 1. Inject an empty homestead save where finishedRunCharacters is empty
      await injectHomestead(page, { finishedRunCharacters: [] });
      await page.goto("/");

      // 2. Verify Talents button is locked and shows tooltip on hover
      const talentsBtn = page.getByRole("button", { name: "Talents" });
      await expect(talentsBtn).toBeVisible();
      await expect(talentsBtn).toHaveAttribute("aria-disabled", "true");
      await talentsBtn.hover();
      await expect(page.getByText("Finish a Run as the Knight to unlock")).toBeVisible();

      await page.mouse.move(0, 0);
      await talentsBtn.click({ force: true });
      await expect(page.getByText("Choose Your Adventure")).toBeHidden();
      await expect(page.getByRole("heading", { name: "Talents" })).toBeHidden();

      // 3. Verify Homestead button is locked and shows tooltip on hover
      const homesteadBtn = page.getByRole("button", { name: "Homestead" });
      await expect(homesteadBtn).toBeVisible();
      await expect(homesteadBtn).toHaveAttribute("aria-disabled", "true");
      await homesteadBtn.hover();
      await expect(page.getByText("Finish a Run as the Knight to unlock")).toBeVisible();

      await page.mouse.move(0, 0);
      await homesteadBtn.click({ force: true });
      await expect(page.getByRole("heading", { name: "Homestead" })).toBeHidden();

      // 4. Verify Armory button is locked and shows tooltip on hover
      const armoryBtn = page.getByRole("button", { name: "Armory" });
      await expect(armoryBtn).toBeVisible();
      await expect(armoryBtn).toHaveAttribute("aria-disabled", "true");
      await armoryBtn.hover();
      await expect(page.getByText("Find Gear to unlock")).toBeVisible();

      await page.mouse.move(0, 0);
      await armoryBtn.click({ force: true });
      await expect(page.getByRole("heading", { name: "Armory" })).toBeHidden();

      // 5. Click Play and verify Labyrinth and Wildwood are locked
      await page.getByRole("button", { name: "Play" }).click();
      await expect(page.getByRole("heading", { name: "Choose Your Adventure" })).toBeVisible();

      const labyrinthCard = page.getByRole("button", { name: /The Labyrinth/ });
      await expect(labyrinthCard).toHaveAttribute("aria-disabled", "true");
      await labyrinthCard.hover();
      await expect(page.getByText("Finish a Run as the Rogue to unlock")).toBeVisible();
      // The lock tooltip must anchor to the hovered tile — not the last tile in
      // the list, which a ref shared across the tiles would resolve to.
      const labyrinthTooltip = page.locator(".hover-popup-panel", { hasText: "Finish a Run as the Rogue to unlock" });
      const labyrinthBox = (await labyrinthCard.boundingBox())!;
      const labyrinthTooltipBox = (await labyrinthTooltip.boundingBox())!;
      const labyrinthTooltipCenterX = labyrinthTooltipBox.x + labyrinthTooltipBox.width / 2;
      const labyrinthCenterX = labyrinthBox.x + labyrinthBox.width / 2;
      expect(Math.abs(labyrinthTooltipCenterX - labyrinthCenterX)).toBeLessThanOrEqual(labyrinthBox.width);

      const wildwoodCard = page.getByRole("button", { name: /Wildwood Draft/ });
      await expect(wildwoodCard).toHaveAttribute("aria-disabled", "true");
      await wildwoodCard.hover();
      await expect(page.getByText("Finish a Run as the Ranger to unlock")).toBeVisible();

      // 6. Start Campaign and check character selection screen locks
      await page.getByRole("button", { name: /The Campaign/ }).click();
      await expect(page.getByRole("heading", { name: "Choose Your Hero" })).toBeVisible();

      // Rogue is locked, Knight is unlocked
      const knightCard = page.getByRole("button", { name: "Select Knight" });
      const rogueCard = page.getByRole("button", { name: "Rogue (Locked)" });
      await expect(knightCard).toBeVisible();
      await expect(rogueCard).toBeVisible();

      await expect(rogueCard).toHaveAttribute("aria-disabled", "true");
      await rogueCard.hover();
      await expect(page.getByText("Finish a Run as the Knight to unlock")).toBeVisible();

      await page.mouse.move(0, 0);
      await rogueCard.click({ force: true });
      await expect(page.getByRole("heading", { name: "Choose Your Hero" })).toBeVisible();

      await knightCard.click();
      await expect(page.getByRole("heading", { name: "Choose Your Hero" })).toBeHidden();
      await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 5000 });
    },
  );

  test("completed progression unlocks meta screens, game modes, and later characters", async ({ page }) => {
    await injectHomestead(page, { finishedRunCharacters: ["knight", "rogue", "wizard", "ranger"] });
    await page.goto("/");

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

    await page.getByRole("button", { name: "Play" }).click();
    const labyrinthCard = page.getByRole("button", { name: /The Labyrinth/ });
    const wildwoodCard = page.getByRole("button", { name: /Wildwood Draft/ });
    await expect(labyrinthCard).not.toHaveClass(/(?<!\S)opacity-50(?!\S)/);
    await expect(wildwoodCard).not.toHaveClass(/(?<!\S)opacity-50(?!\S)/);
    await labyrinthCard.click();
    await expect(page.getByRole("heading", { name: "Choose Your Hero" })).toBeVisible();

    const wizardCard = page.getByRole("button", { name: "Select Wizard" });
    const alchemistCard = page.getByRole("button", { name: "Select Alchemist" });
    await expect(wizardCard).toBeVisible();
    await expect(alchemistCard).toBeVisible();
    await wizardCard.click();
    await expect(page.getByRole("heading", { name: "Labyrinth" })).toBeVisible({ timeout: 5000 });
  });
});
