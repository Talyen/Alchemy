import { expect } from "@playwright/test";
import { test } from "./fixtures/e2e";
import { startAtDestination } from "./helpers";
import { MenuPage } from "./pages/menu-page";
import { MysteryPage } from "./pages/mystery-page";

test.describe("Mystery Event Flow", () => {
  test("mystery event screen shows with title and choices", async ({ page, runtimeErrors }) => {
    void runtimeErrors;
    await startAtDestination(page, {}, { forceDestination: "Mystery" });
    await page.getByRole("button", { name: "Mystery" }).click();
    await new MenuPage(page).stage.expectRunPhase("runLoop");
    await expect(page.getByRole("heading").first()).toBeVisible();
  });

  test("mystery event completes and returns to destination choices", async ({ page, fastBattle, runtimeErrors }) => {
    void fastBattle;
    void runtimeErrors;
    await startAtDestination(page, {}, { forceDestination: "Mystery" });
    await page.getByRole("button", { name: "Mystery" }).click();

    const mystery = new MysteryPage(page);
    await mystery.pickFirstChoice();

    await expect(async () => {
      if (
        await page
          .getByText("Choose a Card")
          .isVisible()
          .catch(() => false)
      ) {
        const cardChoice = page.locator("button[aria-label^='Select']").first();
        await cardChoice.click();
        await page.getByRole("button", { name: "Add Card" }).click();
      }
      if (
        await page
          .getByText("Select a card to remove")
          .isVisible()
          .catch(() => false)
      ) {
        const cardTile = mystery.cardGrid.locator('[aria-label^="Select "]').first();
        await cardTile.click();
        await page.getByRole("button", { name: /^Remove Card$/ }).click();
      }
      await expect(mystery.continueBtn).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 10000 });

    await mystery.continueBtn.click();
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 5000 });
  });
});
