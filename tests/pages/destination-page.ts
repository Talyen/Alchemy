import { expect, type Locator, type Page } from "@playwright/test";

// Every destination choice button names one of these map nodes.
const DESTINATION_NAME = /Combat|Campfire|Merchant|Alchemist|Mystery|Corruption|Trinket Shop|Equipment Shop/;

export class DestinationPage {
  private page: Page;
  readonly heading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = this.page.getByRole("heading", { name: "Choose Destination" });
  }

  async expectVisible(timeout = 5000) {
    // Boss-only runs swap the heading for the upcoming boss's name and some
    // resume paths render no choice buttons yet, so accept either marker.
    // first() keeps the combined locator within strict-mode's one-element rule.
    await expect(this.heading.or(this.page.getByRole("button", { name: DESTINATION_NAME })).first()).toBeVisible({
      timeout,
    });
  }

  destinationButton(name: string) {
    return this.page.getByRole("button", { name, exact: true });
  }

  async pick(name: string) {
    await this.destinationButton(name).click();
  }

  async enterCombat(name: string) {
    await this.pick(name);
    await expect(this.page.getByTestId("battle-scene")).toBeVisible({ timeout: 10_000 });
    await expect(this.page.getByRole("button", { name: "End Turn" })).toBeVisible({ timeout: 10_000 });
    await expect(this.page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10_000 });
  }

  async enterAnyCombat() {
    const combat = this.page.getByRole("button", { name: /^(Normal|Elite) Combat$/ }).first();
    await expect(combat).toBeVisible({ timeout: 10_000 });
    await combat.click();
    await expect(this.page.getByTestId("battle-scene")).toBeVisible({ timeout: 10_000 });
    await expect(this.page.getByRole("button", { name: "End Turn" })).toBeVisible({ timeout: 10_000 });
    await expect(this.page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10_000 });
  }
}
