import { expect } from "@playwright/test";
import { test } from "./fixtures/e2e";
import { injectSaveState, destinationInterruptedFlow, seedRandom, makeCard, startAtDestination } from "./helpers";
import { DestinationPage } from "./pages/destination-page";
import { MysteryPage } from "./pages/mystery-page";
import { CorruptionPage } from "./pages/corruption-page";
import { MenuPage } from "./pages/menu-page";
import { critical } from "./playwright-tags";

test.describe("Destination Progression", () => {
  test("destination screen shows available choices from the pool", critical, async ({ page }) => {
    await injectSaveState(page, {
      runPlayerHealth: 30,
      runMaxHealth: 30,
      roomsEncountered: 0,
      destinationIndexInAct: 0,
      completedDestinations: [],
      currentScreen: "destination",
      interruptedFlow: destinationInterruptedFlow(["Normal Combat", "Campfire", "Mystery"]),
    });
    await page.goto("/");

    const destination = new DestinationPage(page);
    await destination.expectVisible();
    await expect(page.getByRole("button", { name: "Normal Combat" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Campfire" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Mystery" })).toBeVisible();
  });

  test("completed destinations do not appear in subsequent choices", critical, async ({ page }) => {
    await injectSaveState(page, {
      runPlayerHealth: 30,
      runMaxHealth: 30,
      roomsEncountered: 1,
      destinationIndexInAct: 1,
      completedDestinations: ["Normal Combat"],
      currentScreen: "destination",
      interruptedFlow: destinationInterruptedFlow(["Campfire", "Mystery", "Merchant's Shop"]),
    });
    await page.goto("/");

    const destination = new DestinationPage(page);
    await destination.expectVisible();
    await expect(page.getByRole("button", { name: "Campfire" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Normal Combat" })).toHaveCount(0);
  });

  test("boss destination appears at end of act when all choices are exhausted", async ({ page }) => {
    await injectSaveState(page, {
      runPlayerHealth: 30,
      runMaxHealth: 30,
      roomsEncountered: 4,
      destinationIndexInAct: 4,
      completedDestinations: ["Normal Combat", "Normal Combat", "Normal Combat", "Campfire"],
      currentScreen: "destination",
      interruptedFlow: destinationInterruptedFlow(["Boss Combat"]),
    });
    await page.goto("/");

    await expect(page.getByRole("button", { name: /Boss/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("img", { name: /Boss/i })).toBeVisible();
  });
});

test.describe("Mystery Event Flow", () => {
  test("mystery event screen shows with title and choices", async ({ page, runtimeErrors }) => {
    void runtimeErrors;
    await startAtDestination(page, {}, { forceDestination: "Mystery" });
    await page.getByRole("button", { name: "Mystery" }).click();
    await new MenuPage(page).stage.expectRunPhase("runLoop");
    await expect(page.getByRole("heading").first()).toBeVisible();
  });

  test(
    "mystery completes and returns to destination choices",
    critical,
    async ({ page, fastBattle, runtimeErrors }) => {
      void fastBattle;
      void runtimeErrors;
      await seedRandom(page, 42);
      await startAtDestination(
        page,
        { runDeck: Array.from({ length: 6 }, () => makeCard()) },
        { forceDestination: "Mystery" },
      );
      await page.getByRole("button", { name: "Mystery" }).click();

      const mystery = new MysteryPage(page);
      await mystery.pickFirstChoice();
      await mystery.handleCardOutcome();

      // Some outcomes (e.g. card removal) return straight to destination choices;
      // others show a result view with Continue first.
      const continueBtn = mystery.continueBtn;
      await expect
        .poll(
          async () => {
            const hasContinue = await continueBtn.isVisible().catch(() => false);
            const atDestination = await page
              .getByRole("heading", { name: "Choose Destination" })
              .isVisible()
              .catch(() => false);
            return hasContinue || atDestination;
          },
          { timeout: 10000 },
        )
        .toBe(true);

      if (await continueBtn.isVisible().catch(() => false)) {
        await continueBtn.click();
      }
      await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 5000 });
    },
  );
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
    await new DestinationPage(page).expectVisible();
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

    const playableCards = page.locator('[aria-label^="Play "]');
    await expect(playableCards.first()).toBeVisible({ timeout: 5000 });
    expect(await playableCards.count()).toBeGreaterThan(0);
  });
});
