import { expect, test } from "@playwright/test";
import { startAtDestination, navigateToDestination } from "./helpers";

test.describe("Mystery Event Outcomes", () => {
  test("mystery event screen shows with title and choices", async ({ page }) => {
    await startAtDestination(page);
    await navigateToDestination(page, "Mystery");
    await expect(page.getByRole("heading").first()).toBeVisible();
  });

  test("mystery event completes and returns to destination choices", async ({ page }) => {
    await startAtDestination(page);
    await navigateToDestination(page, "Mystery");

    await page.waitForTimeout(1500);

    const choiceBtn = page.locator("button").filter({ hasText: /Fish|Dance|Harvest|Explore|Collect|Read|Pray|Bathe|Study|Mine|Scout|Search|Take|Dredge|Gather|Bask|Follow|Copy|Organize|Leave|Decipher/i }).first();
    await expect(choiceBtn).toBeVisible({ timeout: 3000 });
    await choiceBtn.click();
    await page.waitForTimeout(500);

    const hasRemoveCard = await page.getByText("Select a card to remove").isVisible({ timeout: 500 }).catch(() => false);
    if (hasRemoveCard) {
      const cardTile = page.locator("button").filter({ has: page.locator("button") }).first();
      await cardTile.waitFor({ timeout: 2000 });
      await cardTile.click();
      await page.waitForTimeout(200);
      await page.getByRole("button", { name: "Remove Card" }).click();
      await page.waitForTimeout(200);
    }

    const hasCardChoice = await page.getByText("Choose a Card").isVisible({ timeout: 500 }).catch(() => false);
    if (hasCardChoice) {
      const cardChoice = page.locator("button[aria-label^='Select']").first();
      await cardChoice.waitFor({ timeout: 2000 });
      await cardChoice.click();
      await page.waitForTimeout(200);
      await page.getByRole("button", { name: "Add Card" }).click();
      await page.waitForTimeout(200);
    }

    await expect(page.getByRole("button", { name: "Continue" })).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 5000 });
  });
});
