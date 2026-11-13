import { expect, type Page } from "@playwright/test";

export class RewardPage {
  constructor(private page: Page) {}

  async claimFirstReward() {
    const choice = this.page.locator('[aria-label^="Select "]').first();
    await expect(choice).toBeVisible({ timeout: 10_000 });
    await expect(choice).toBeEnabled({ timeout: 5_000 });
    await expect.poll(() => choice.evaluate((element) => !element.closest("[inert]"))).toBe(true);
    await choice.click();
  }

  async skipReward() {
    const skipBtn = this.page.getByRole("button", { name: "Skip", exact: true });
    await expect(skipBtn).toBeVisible({ timeout: 10_000 });
    await expect(skipBtn).toBeEnabled({ timeout: 5_000 });
    await expect.poll(() => skipBtn.evaluate((element) => !element.closest("[inert]"))).toBe(true);
    await skipBtn.click();
  }
}
