import { expect, type Locator, type Page } from "@playwright/test";

export class MysteryPage {
  private page: Page;
  readonly choiceBtn: Locator;
  readonly continueBtn: Locator;
  readonly cardGrid: Locator;

  constructor(page: Page) {
    this.page = page;
    this.choiceBtn = this.page.getByTestId("mystery-choice").first();
    this.continueBtn = this.page.getByRole("button", { name: "Continue" });
    this.cardGrid = this.page.locator('[data-testid="card-selection-grid"]');
  }

  async pickFirstChoice() {
    await expect(this.choiceBtn).toBeVisible({ timeout: 3000 });
    await this.choiceBtn.click();
  }

  async handleCardOutcome() {
    const hasPicker = await this.cardGrid.isVisible().catch(() => false);
    if (!hasPicker) return;

    const cardChoice = this.cardGrid.locator("button[aria-label^='Select']").first();
    await expect(cardChoice).toBeVisible({ timeout: 5000 });
    await expect(cardChoice).toBeEnabled({ timeout: 3000 });
    await expect.poll(() => cardChoice.evaluate((element) => !element.closest("[inert]"))).toBe(true);
    await cardChoice.click();
    const addCardBtn = this.page.getByRole("button", { name: "Add Card" });
    await expect(addCardBtn).toBeVisible({ timeout: 3000 });
    await expect(addCardBtn).toBeEnabled({ timeout: 3000 });
    await addCardBtn.click();
  }
}
