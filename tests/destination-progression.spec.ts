import { expect, test } from "@playwright/test";
import { injectSaveState } from "./helpers";
import { DestinationPage } from "./pages/destination-page";
import { critical } from "./playwright-tags";

test.describe("Destination Progression", critical, () => {
  test("destination screen shows available choices from the pool", async ({ page }) => {
    await injectSaveState(page, {
      runPlayerHealth: 30,
      runMaxHealth: 30,
      roomsEncountered: 0,
      destinationIndexInAct: 0,
      completedDestinations: [],
      currentScreen: "destination",
      destinationChoices: ["Normal Combat", "Campfire", "Mystery"],
    });
    await page.goto("/");

    const destination = new DestinationPage(page);
    await destination.expectVisible();
    await expect(page.getByRole("button", { name: "Normal Combat" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Campfire" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Mystery" })).toBeVisible();
  });

  test("completed destinations do not appear in subsequent choices", async ({ page }) => {
    await injectSaveState(page, {
      runPlayerHealth: 30,
      runMaxHealth: 30,
      roomsEncountered: 1,
      destinationIndexInAct: 1,
      completedDestinations: ["Normal Combat"],
      currentScreen: "destination",
      destinationChoices: ["Campfire", "Mystery", "Merchant's Shop"],
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
      destinationChoices: ["Boss Combat"],
    });
    await page.goto("/");

    await expect(page.getByRole("button", { name: /Boss/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("img", { name: /Boss/i })).toBeVisible();
  });
});
