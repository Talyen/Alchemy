import { expect, type Locator, type Page } from "@playwright/test";

export class RewardPage {
  private page: Page;
  readonly addRewardBtn: Locator;

  constructor(page: Page) {
    this.page = page;
    this.addRewardBtn = this.page.getByRole("button", { name: /^(Add Card|Take Trinket)$/ });
  }

  async selectFirstReward() {
    await this.page.locator('[aria-label^="Select "]').first().click();
  }

  async claimFirstReward() {
    await this.selectFirstReward();
    await expect(this.addRewardBtn).toBeEnabled({ timeout: 2000 });
    await this.addRewardBtn.click();
  }
}
