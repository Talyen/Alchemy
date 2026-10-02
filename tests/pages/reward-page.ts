import { expect, type Page } from "@playwright/test";

export class RewardPage {
  constructor(private page: Page) {}

  async claimFirstReward() {
    const choice = this.page.locator('[aria-label^="Select "]').first();
    await expect(choice).toBeEnabled();
    await choice.click();
  }
}
