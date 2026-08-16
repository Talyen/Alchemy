import { expect, type Locator, type Page } from "@playwright/test";
import { startAtDestination } from "../helpers";
import { GameStage } from "./game-stage";
import type { DestinationName } from "../e2e/types";

export class ShopPage {
  private page: Page;
  readonly stage: GameStage;
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
  readonly inspectButtons: Locator;

  constructor(page: Page) {
    this.page = page;
    this.stage = new GameStage(page);
    this.heading = this.page.getByRole("heading", { name: /(Merchant|Alchemist|Trinket|Equipment)/ });
    this.buyBtn = this.page.getByRole("button", { name: /^Buy/ });
    this.removeCardBtn = this.page.getByRole("button", { name: /Remove Card/ });
    this.refreshBtn = this.page.getByRole("button", { name: /Refresh/ });
    this.mixBtn = this.page.getByRole("button", { name: /Mix Potions/ });
    this.combineBtn = this.page.getByRole("button", { name: "Combine" });
    this.continueBtn = this.page.getByRole("button", { name: "Continue" });
    this.goldText = this.page.getByText(/\d+ Gold/).first();
    this.purchasedText = this.page.getByText("Purchased").first();
    this.cardGrid = this.page.locator('[data-testid="card-selection-grid"]');
    this.inspectButtons = this.page.locator('button[aria-label^="Buy "]');
  }

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

  async getInspectLabels(): Promise<Array<string | null>> {
    return Promise.all((await this.inspectButtons.all()).map((btn) => btn.getAttribute("aria-label")));
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

  async enterFromDestination(gold: number, destination: DestinationName) {
    await startAtDestination(this.page, { runGold: gold }, { forceDestination: destination });
    await this.page.getByRole("button", { name: destination }).click();
    await expect(this.page.getByRole("heading", { name: destination })).toBeVisible();
  }

  async navigateToDestination(name: string) {
    await this.page.getByRole("button", { name }).click();
  }
}
