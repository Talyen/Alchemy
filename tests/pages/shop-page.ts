import { expect, type Locator, type Page } from "@playwright/test";

export class ShopPage {
  private page: Page;
  readonly heading: Locator;
  readonly buyBtn: Locator;
  readonly removeCardBtn: Locator;
  readonly refreshBtn: Locator;
  readonly mixBtn: Locator;
  readonly combineBtn: Locator;
  readonly continueBtn: Locator;
  readonly goldText: Locator;
  readonly purchasedText: Locator;
  readonly cardGrid: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = this.page.getByRole("heading", { name: /(Card Shop|Alchemist|Trinket|Equipment)/ });
    this.buyBtn = this.page.getByRole("button", { name: /^Buy/ });
    this.removeCardBtn = this.page.getByRole("button", { name: /Remove Card/ });
    this.refreshBtn = this.page.getByRole("button", { name: /Refresh/ });
    this.mixBtn = this.page.getByRole("button", { name: /^Brew Potion/ });
    this.combineBtn = this.page.getByRole("button", { name: /^Brew(?: ·.*)?$/ });
    this.continueBtn = this.page.getByRole("button", { name: "Continue" });
    this.goldText = this.page.getByTestId("run-gold");
    this.purchasedText = this.page.getByText("Purchased").first();
    this.cardGrid = this.page.locator('[data-testid="card-selection-grid"]');
  }

  async gold(): Promise<number> {
    const label = await this.goldText.getAttribute("aria-label");
    if (!label) throw new Error("Gold display has no accessible amount");
    return Number(label.replace(/^Gold:\s*/, ""));
  }

  async buyCard(index = 0) {
    const btn = this.buyBtn.nth(index);
    await expect(btn).toBeVisible();
    await expect(btn).toBeEnabled();
    await btn.click();
  }

  async waitForPurchase() {
    await expect(this.purchasedText).toBeVisible({ timeout: 3000 });
  }

  async startCardRemoval() {
    await expect(this.removeCardBtn).toBeVisible();
    await expect(this.removeCardBtn).toBeEnabled();
    await this.removeCardBtn.click();
  }

  async selectCardInGrid(index = 0) {
    const card = this.cardGrid.locator('[aria-label^="Select "]').nth(index);
    await card.click();
  }

  async confirmRemoval() {
    await expect(this.removeCardBtn).toBeEnabled({ timeout: 3000 });
    await this.removeCardBtn.click();
  }

  async refresh() {
    await expect(this.refreshBtn).toBeEnabled();
    await this.refreshBtn.click();
  }
}
