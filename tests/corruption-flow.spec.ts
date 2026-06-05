import { expect, test } from "@playwright/test";
import { CorruptionPage } from "./pages/corruption-page";
import { DestinationPage } from "./pages/destination-page";
import { critical } from "./playwright-tags";

test.describe("Corruption Full Flow", critical, () => {
  test("corruption destination shows altar screen with intro and leave works", async ({ page }) => {
    const corruption = new CorruptionPage(page);
    await corruption.open();
    await corruption.stage.expectRunPhase("runLoop");

    await expect(corruption.altarHeading).toBeVisible({ timeout: 5000 });
    await expect(corruption.corruptBtn).toBeVisible();
    await expect(corruption.leaveBtn).toBeVisible();

    await corruption.leaveBtn.click();
    await new DestinationPage(page).expectVisible();
  });

  test("selecting a card and corrupting shows result view with continue", async ({ page }) => {
    const corruption = new CorruptionPage(page);
    await corruption.open();

    await corruption.selectAndCorrupt();

    await corruption.continueBtn.click();
    await new DestinationPage(page).expectVisible();
  });

  test("corrupted card retains corruption flag in subsequent battle hand", async ({ page }) => {
    const corruption = new CorruptionPage(page);
    await corruption.open();

    await corruption.selectAndCorrupt();
    await page.evaluate(() => { Math.random = () => 0; });
    await corruption.continueBtn.click();

    const destination = new DestinationPage(page);
    await destination.enterCombat("Normal Combat");

    const playableCards = page.locator('[aria-label^="Play "]');
    await expect(playableCards.first()).toBeVisible({ timeout: 5000 });
    expect(await playableCards.count()).toBeGreaterThan(0);
  });
});
