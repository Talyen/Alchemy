import { controllerInput } from "../controller-input";
import { expect } from "@playwright/test";
import { test } from "../../fixtures/e2e";
import { injectDestinationAtIndex, injectMysterySummaryVisit, assertRowAlignment } from "../../browser-helpers";
import { DestinationPage } from "../../pages/destination-page";
import { MysteryPage } from "../../pages/mystery-page";
import { CorruptionPage } from "../../pages/corruption-page";
import { critical } from "../../playwright-tags";

test.describe("Destination Progression", () => {
  test("destination screen shows available choices from the pool", critical, async ({ page }) => {
    await injectDestinationAtIndex(page, {
      destinations: ["Normal Combat", "Campfire", "Mystery"],
    });
    await page.goto("/");

    const destination = new DestinationPage(page);
    await destination.expectVisible();
    const choices = [
      destination.destinationButton("Combat"),
      destination.destinationButton("Campfire"),
      destination.destinationButton("Mystery"),
    ];
    for (const choice of choices) {
      await expect(choice).toBeVisible();
    }
    await assertRowAlignment(choices);
    await expect(page.getByRole("button", { name: "Normal Combat", exact: true })).toHaveCount(0);
    await destination.pick("Combat");
    await expect(page.getByTestId("battle-scene")).toBeVisible();
    await expect(page.getByRole("button", { name: "End Turn" })).toBeVisible();
  });

  // Pool exhaustion and boss-appearance rules live in run-destination-wiring
  // and run-domain-progress unit tests; the browser keeps the choice-pool,
  // mystery, and corruption-result wirings.
});

test.describe("Mystery Event Flow", () => {
  test("mystery completes and returns to destination choices", critical, async ({ page }) => {
    await injectMysterySummaryVisit(page);
    await page.goto("/");

    const mystery = new MysteryPage(page);
    await expect(mystery.continueBtn).toBeVisible({ timeout: 10000 });
    await mystery.continueBtn.click();
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Corruption Full Flow", () => {
  // Altar intro/leave and corrupted-in-deck membership live in
  // corruption.test.ts (engine) plus the result-flow wiring below.
  test("selecting a card and corrupting shows result view with continue", critical, async ({ page }) => {
    const corruption = new CorruptionPage(page);
    await corruption.open();

    const input = controllerInput(page);
    await input.activate(corruption.corruptBtn);
    await input.activate(corruption.cardGrid.getByRole("button", { name: /^Select / }).first());
    await input.activate(corruption.confirmCorruptBtn);

    await controllerInput(page).activate(corruption.continueBtn);
    await new DestinationPage(page).expectVisible();
  });
});
