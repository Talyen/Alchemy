import { expect, test } from "@playwright/test";
import { startAtDestination, navigateToDestination } from "./helpers";

test.describe("Mystery Card Removal Path", () => {
  test("mystery event can result in card removal", async ({ page }) => {
    await startAtDestination(page);
    await navigateToDestination(page, "Mystery");

    await page.waitForTimeout(1500);

    const choiceBtn = page.locator("button").filter({ hasText: /Fish|Dance|Harvest|Explore|Collect|Read|Pray|Bathe|Study|Mine|Scout|Search|Take|Dredge|Gather|Bask|Follow|Copy|Organize|Leave|Decipher/i }).first();
    await expect(choiceBtn).toBeVisible({ timeout: 3000 });
    await choiceBtn.click();
    await page.waitForTimeout(500);

    const hasRemoveCard = await page.getByText("Select a card to remove").isVisible({ timeout: 1000 }).catch(() => false);
    if (hasRemoveCard) {
      const cardTile = page.locator("button").filter({ has: page.locator("button") }).first();
      await cardTile.waitFor({ timeout: 2000 });
      await cardTile.click();
      await page.waitForTimeout(200);
      await page.getByRole("button", { name: "Remove Card" }).click();
      await page.waitForTimeout(200);

      await expect(page.getByRole("button", { name: "Continue" })).toBeVisible({ timeout: 5000 });
      await page.getByRole("button", { name: "Continue" }).click();
      await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 5000 });
    }
  });

  test("mystery event can result in card choice reward", async ({ page }) => {
    await startAtDestination(page);
    await navigateToDestination(page, "Mystery");

    await page.waitForTimeout(1500);

    const choiceBtn = page.locator("button").filter({ hasText: /Fish|Dance|Harvest|Explore|Collect|Read|Pray|Bathe|Study|Mine|Scout|Search|Take|Dredge|Gather|Bask|Follow|Copy|Organize|Leave|Decipher/i }).first();
    await expect(choiceBtn).toBeVisible({ timeout: 3000 });
    await choiceBtn.click();
    await page.waitForTimeout(500);

    const hasCardChoice = await page.getByText("Choose a Card").isVisible({ timeout: 1000 }).catch(() => false);
    if (hasCardChoice) {
      const cardChoice = page.locator("button[aria-label^='Select']").first();
      await cardChoice.waitFor({ timeout: 2000 });
      await cardChoice.click();
      await page.waitForTimeout(200);
      await page.getByRole("button", { name: "Add Card" }).click();
      await page.waitForTimeout(200);

      await expect(page.getByRole("button", { name: "Continue" })).toBeVisible({ timeout: 5000 });
      await page.getByRole("button", { name: "Continue" }).click();
      await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 5000 });
    }
  });
});
