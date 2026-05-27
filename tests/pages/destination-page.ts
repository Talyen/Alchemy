import { expect, type Page } from "@playwright/test";

export class DestinationPage {
  constructor(private page: Page) {}

  readonly heading = this.page.getByRole("heading", { name: "Choose Destination" });

  async expectVisible(timeout = 5000) {
    await expect(this.heading).toBeVisible({ timeout });
  }

  destinationButton(name: string) {
    return this.page.getByRole("button", { name });
  }

  async pick(name: string) {
    await this.destinationButton(name).click();
  }

  async enterCombat(name: string) {
    await this.pick(name);
    await this.page.evaluate(() => {
      window.disableForceDestination = true;
    });
    await expect(this.page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 5000 });
  }
}
