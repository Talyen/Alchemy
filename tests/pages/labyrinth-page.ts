import { expect, type Locator, type Page } from "@playwright/test";

export class LabyrinthPage {
  private page: Page;
  readonly heading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = this.page.getByRole("heading", { name: /Labyrinth|Map/i });
  }

  async expectVisible() {
    await expect(this.heading).toBeVisible({ timeout: 20000 });
  }

  chamberButton(name: RegExp | string) {
    return this.page.getByRole("button", { name });
  }

  async enterCombatChamber() {
    await this.chamberButton(/Combat chamber/i).click();
  }
}
