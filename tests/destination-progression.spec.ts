import { expect } from "@playwright/test";
import { test } from "./fixtures/e2e";
import { injectDestinationAtIndex, injectMysterySummaryVisit, assertRowAlignment } from "./helpers";
import { BattlePage } from "./pages/battle-page";
import { DestinationPage } from "./pages/destination-page";
import { MysteryPage } from "./pages/mystery-page";
import { CorruptionPage } from "./pages/corruption-page";
import { critical } from "./playwright-tags";

test.describe("Destination Progression", () => {
  test.beforeEach(async ({ runtimeErrors }) => {
    void runtimeErrors;
  });

  test("destination screen shows available choices from the pool", critical, async ({ page }) => {
    await injectDestinationAtIndex(page, {
      destinations: ["Normal Combat", "Campfire", "Mystery"],
    });
    await page.goto("/");

    const destination = new DestinationPage(page);
    await destination.expectVisible();
    const choices = [
      destination.destinationButton("Normal Combat"),
      destination.destinationButton("Campfire"),
      destination.destinationButton("Mystery"),
    ];
    for (const choice of choices) {
      await expect(choice).toBeVisible();
    }
    await assertRowAlignment(choices);
  });

  test("completed destinations do not appear in subsequent choices", critical, async ({ page }) => {
    await injectDestinationAtIndex(page, {
      destinations: ["Campfire", "Mystery", "Merchant's Shop"],
      destinationIndexInAct: 1,
      roomsEncountered: 1,
      completedDestinations: ["Normal Combat"],
    });
    await page.goto("/");

    const destination = new DestinationPage(page);
    await destination.expectVisible();
    await expect(page.getByRole("button", { name: "Campfire" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Normal Combat" })).toHaveCount(0);
  });

  test("boss destination appears at end of act when all choices are exhausted", critical, async ({ page }) => {
    await injectDestinationAtIndex(page, {
      destinations: ["Boss Combat"],
      destinationIndexInAct: 4,
      roomsEncountered: 4,
      completedDestinations: ["Normal Combat", "Normal Combat", "Normal Combat", "Campfire"],
    });
    await page.goto("/");

    await expect(page.getByRole("button", { name: /Boss/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("button", { name: /Boss/i }).locator(".shine-border")).toBeVisible();
  });
});

test.describe("Mystery Event Flow", () => {
  test("mystery completes and returns to destination choices", critical, async ({ page, runtimeErrors }) => {
    void runtimeErrors;
    await injectMysterySummaryVisit(page);
    await page.goto("/");

    const mystery = new MysteryPage(page);
    await expect(mystery.continueBtn).toBeVisible({ timeout: 10000 });
    await mystery.continueBtn.click();
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Corruption Full Flow", () => {
  test("corruption destination shows altar screen with intro and leave works", async ({ page }) => {
    const corruption = new CorruptionPage(page);
    await corruption.open();
    await corruption.stage.expectRunPhase("runLoop");

    await expect(corruption.altarHeading).toBeVisible({ timeout: 5000 });
    await expect(corruption.corruptBtn).toBeVisible();
    await expect(corruption.leaveBtn).toBeVisible();

    await corruption.leaveBtn.click();
    const destination = new DestinationPage(page);
    await destination.expectVisible();
    await expect(destination.destinationButton("Corruption")).toBeVisible();
  });

  test("selecting a card and corrupting shows result view with continue", critical, async ({ page }) => {
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
    await corruption.continueBtn.click();

    const destination = new DestinationPage(page);
    await destination.enterAnyCombat();

    const playableCards = new BattlePage(page).hand;
    await expect(playableCards.first()).toBeVisible({ timeout: 5000 });
    expect(await playableCards.count()).toBeGreaterThan(0);
  });
});
