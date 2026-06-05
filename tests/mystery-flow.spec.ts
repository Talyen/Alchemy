import { expect, test } from "@playwright/test";
import { startAtDestination } from "./helpers";
import { MenuPage } from "./pages/menu-page";
import { MysteryPage } from "./pages/mystery-page";

test.describe("Mystery Event Flow", () => {
  test("mystery event screen shows with title and choices", async ({ page }) => {
    await startAtDestination(page, {}, { forceDestination: "Mystery" });
    await page.getByRole("button", { name: "Mystery" }).click();
    await new MenuPage(page).stage.expectRunPhase("runLoop");
    await expect(page.getByRole("heading").first()).toBeVisible();
  });

  test("mystery event completes and returns to destination choices", async ({ page }) => {
    await startAtDestination(page, {}, { forceDestination: "Mystery" });
    await page.getByRole("button", { name: "Mystery" }).click();

    const mystery = new MysteryPage(page);
    await mystery.pickFirstChoice();
    await mystery.handleCardOutcome();

    await expect(mystery.continueBtn).toBeVisible({ timeout: 5000 });
    await mystery.continueBtn.click();
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 5000 });
  });
});
