import { expect, type Page } from "@playwright/test";

export class RewardPage {
  constructor(private page: Page) {}

  readonly addRewardBtn = this.page.getByRole("button", { name: /^(Add Card|Take Boon)$/ });

  async selectFirstReward() {
    await this.page.locator('[aria-label^="Select "]').first().click();
  }

  async claimFirstReward() {
    await this.selectFirstReward();
    await expect(this.addRewardBtn).toBeEnabled({ timeout: 2000 });
    await this.addRewardBtn.click();
  }
}
