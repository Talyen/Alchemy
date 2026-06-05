import { expect, type Page } from "@playwright/test";
import { startAtDestination } from "../helpers";
import { GameStage } from "./game-stage";

export class ShopPage {
  readonly stage: GameStage;

  constructor(private page: Page) {
    this.stage = new GameStage(page);
  }

  readonly heading = this.page.getByRole("heading", { name: /(Merchant|Alchemist)/ });
  readonly buyBtn = this.page.getByRole("button", { name: /^Buy/ });
  readonly removeCardBtn = this.page.getByRole("button", { name: /Remove Card/ });
  readonly refreshBtn = this.page.getByRole("button", { name: /Refresh/ });
  readonly mixBtn = this.page.getByRole("button", { name: /Mix Potions/ });
  readonly combineBtn = this.page.getByRole("button", { name: "Combine" });
  readonly continueBtn = this.page.getByRole("button", { name: "Continue" });
  readonly goldText = this.page.getByText(/\d+ Gold/).first();
  readonly purchasedText = this.page.getByText("Purchased").first();
  readonly cardGrid = this.page.locator('[data-testid="card-selection-grid"]');
  readonly inspectButtons = this.page.locator('button[aria-label^="Inspect "]');

  async gold(): Promise<number> {
    const text = await this.goldText.textContent();
    return text ? Number(text.match(/\d+/)?.[0]) : 0;
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
    await expect(this.refreshBtn).toBeVisible();
    await expect(this.refreshBtn).toBeEnabled();
    await this.refreshBtn.click();
  }

  async getInspectLabels(): Promise<(string | null)[]> {
    return Promise.all(
      (await this.inspectButtons.all()).map((btn) => btn.getAttribute("aria-label"))
    );
  }

  async mixPotions() {
    await expect(this.mixBtn).toBeEnabled();
    await this.mixBtn.click();
    await expect(this.page.getByText("Select two Potions to Combine")).toBeVisible();
    const selectBtns = this.page.getByRole("button", { name: /^Select / });
    await selectBtns.nth(0).click();
    await selectBtns.nth(1).click();
    await expect(this.combineBtn).toBeEnabled({ timeout: 3000 });
    await this.combineBtn.click();
    await expect(this.page.getByText("Added to Deck: Mixed Potion")).toBeVisible({ timeout: 3000 });
  }

  async enterFromDestination(gold: number, destination: "Merchant's Shop" | "Alchemist's Shop") {
    await startAtDestination(this.page, { runGold: gold }, { forceDestination: destination });
    await this.page.getByRole("button", { name: destination }).click();
    await expect(this.page.getByRole("heading", { name: destination })).toBeVisible();
  }

  async navigateToDestination(name: string) {
    await this.page.getByRole("button", { name }).click();
  }
}
