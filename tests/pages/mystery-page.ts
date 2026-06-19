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
    const removeCardText = this.page.getByText("Select a card to remove");
    const cardChoiceText = this.page.getByText("Choose a Card");

    const hasPicker = await expect(async () => {
      const hasRemove = await removeCardText.isVisible().catch(() => false);
      const hasChoice = await cardChoiceText.isVisible().catch(() => false);
      expect(hasRemove || hasChoice).toBe(true);
    })
      .toPass({ timeout: 5000 })
      .then(() => true)
      .catch(() => false);

    if (!hasPicker) return;

    if (await removeCardText.isVisible().catch(() => false)) {
      const cardTile = this.cardGrid.locator('[aria-label^="Select "]').first();
      await expect(cardTile).toBeVisible({ timeout: 5000 });
      await cardTile.click();
      await this.page.getByRole("button", { name: /^Remove Card$/ }).click();
    } else {
      const cardChoice = this.page.locator("button[aria-label^='Select']").first();
      await expect(cardChoice).toBeVisible({ timeout: 5000 });
      await cardChoice.click();
      await this.page.getByRole("button", { name: "Add Card" }).click();
    }
  }
}
