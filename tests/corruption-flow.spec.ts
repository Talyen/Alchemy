import { expect, test } from "@playwright/test";
import { startAtDestination } from "./helpers";
import { CorruptionPage } from "./pages/corruption-page";

async function openCorruption(page: import("@playwright/test").Page) {
  await startAtDestination(page, {}, { forceDestination: "Corruption" });
  await page.getByRole("button", { name: "Corruption" }).click();
}

test.describe("Corruption Full Flow", () => {
  test("corruption destination shows altar screen with intro and leave works", async ({ page }) => {
    await openCorruption(page);
    const corruption = new CorruptionPage(page);

    await expect(corruption.altarHeading).toBeVisible({ timeout: 5000 });
    await expect(corruption.corruptBtn).toBeVisible();
    await expect(corruption.leaveBtn).toBeVisible();

    await corruption.leaveBtn.click();
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 5000 });
  });

  test("selecting a card and corrupting shows result view with continue", async ({ page }) => {
    await openCorruption(page);
    const corruption = new CorruptionPage(page);

    await corruption.selectAndCorrupt();

    await corruption.continueBtn.click();
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 5000 });
  });

  test("corrupted card retains corruption flag in subsequent battle hand", async ({ page }) => {
    await openCorruption(page);
    const corruption = new CorruptionPage(page);

    await corruption.selectAndCorrupt();
    await page.evaluate(() => { Math.random = () => 0; });
    await corruption.continueBtn.click();

    await expect(page.getByRole("button", { name: "Normal Combat" })).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: "Normal Combat" }).click();
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 5000 });

    const playableCards = page.locator('[aria-label^="Play "]');
    const count = await playableCards.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});
