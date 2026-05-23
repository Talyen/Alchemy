import { expect, test } from "@playwright/test";
import { startAtDestination } from "./helpers";

test.describe("Mystery Event Flow", () => {
  test("mystery event screen shows with title and choices", async ({ page }) => {
    await startAtDestination(page, {}, { forceDestination: "Mystery" });
    await page.getByRole("button", { name: "Mystery" }).click();
    await expect(page.getByRole("heading").first()).toBeVisible();
  });

  test("mystery event completes and returns to destination choices", async ({ page }) => {
    await startAtDestination(page, {}, { forceDestination: "Mystery" });
    await page.getByRole("button", { name: "Mystery" }).click();

    const choiceBtn = page.getByTestId("mystery-choice").first();
    await expect(choiceBtn).toBeVisible({ timeout: 3000 });
    await choiceBtn.click();

    const removeCardText = page.getByText("Select a card to remove");
    const cardChoiceText = page.getByText("Choose a Card");
    await expect(async () => {
      const hasRemove = await removeCardText.isVisible().catch(() => false);
      const hasChoice = await cardChoiceText.isVisible().catch(() => false);
      expect(hasRemove || hasChoice).toBe(true);
    }).toPass({ timeout: 5000 });

    if (await removeCardText.isVisible().catch(() => false)) {
      const cardTile = page.locator('[data-testid="card-selection-grid"] [aria-label^="Select "]').first();
      await expect(cardTile).toBeVisible({ timeout: 3000 });
      await cardTile.click();
      await page.getByRole("button", { name: /^Remove Card$/ }).click();
    } else if (await cardChoiceText.isVisible().catch(() => false)) {
      const cardChoice = page.locator("button[aria-label^='Select']").first();
      await cardChoice.waitFor({ timeout: 3000 });
      await cardChoice.click();
      await page.getByRole("button", { name: "Add Card" }).click();
    }

    await expect(page.getByRole("button", { name: "Continue" })).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 5000 });
  });
});
