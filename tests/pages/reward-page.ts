import { expect, type Page } from "@playwright/test";

export class RewardPage {
  constructor(private page: Page) {}

  async claimFirstReward() {
    await expect(this.page.getByRole("button", { name: /^(Add Card|Take Boon|Take Trinket|Take Gear)$/ })).toHaveCount(
      0,
    );
    const choice = this.page.locator('[aria-label^="Select "]').first();
    await expect(choice.locator(".shine-border")).toHaveCount(0);
    await choice.hover();
    await expect(choice.locator(".shine-border")).toHaveCount(1);
    await this.page.getByRole("heading", { name: "Victory", exact: true }).hover();
    await expect(choice.locator(".shine-border")).toHaveCount(0);
    await choice.focus();
    await expect(choice.locator(".shine-border")).toHaveCount(1);
    await choice.press("Enter");
  }
}
