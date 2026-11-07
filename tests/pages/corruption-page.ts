import { expect, type Locator, type Page } from "@playwright/test";
import { startAtDestination } from "../e2e/battle-setup";

export class CorruptionPage {
  private page: Page;
  readonly altarHeading: Locator;
  readonly corruptBtn: Locator;
  readonly confirmCorruptBtn: Locator;
  readonly leaveBtn: Locator;
  readonly continueBtn: Locator;
  readonly cardGrid: Locator;

  constructor(page: Page) {
    this.page = page;
    this.altarHeading = this.page.getByRole("heading", { name: "Altar of Corruption" });
    this.corruptBtn = this.page.getByRole("button", { name: "Corrupt a Card" });
    this.confirmCorruptBtn = this.page.getByRole("button", { name: "Corrupt", exact: true });
    this.leaveBtn = this.page.getByRole("button", { name: "Leave" });
    this.continueBtn = this.page.getByRole("button", { name: "Continue" });
    this.cardGrid = this.page.locator('[data-testid="card-selection-grid"]');
  }

  async open() {
    await startAtDestination(this.page, {}, { forceDestination: "Corruption" });
    await this.page.getByRole("button", { name: "Corruption" }).click();
  }

  async selectAndCorrupt(index = 0) {
    await this.corruptBtn.click();
    await expect(this.cardGrid).toBeVisible({ timeout: 5000 });
    const card = this.cardGrid.locator('[aria-label^="Select "]').nth(index);
    await expect(card).toBeVisible({ timeout: 5000 });
    await expect(card).toBeEnabled({ timeout: 3000 });
    await expect.poll(() => card.evaluate((element) => !element.closest("[inert]"))).toBe(true);
    await card.click();
    await expect(this.confirmCorruptBtn).toBeEnabled({ timeout: 3000 });
    await this.confirmCorruptBtn.click();
    await expect(this.continueBtn).toBeVisible({ timeout: 5000 });
  }
}
