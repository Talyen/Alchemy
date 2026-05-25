import { expect, type Page } from "@playwright/test";

export class MysteryPage {
  constructor(private page: Page) {}

  readonly choiceBtn = this.page.getByTestId("mystery-choice").first();
  readonly continueBtn = this.page.getByRole("button", { name: "Continue" });
  readonly cardGrid = this.page.locator('[data-testid="card-selection-grid"]');

  async pickFirstChoice() {
    await expect(this.choiceBtn).toBeVisible({ timeout: 3000 });
    await this.choiceBtn.click();
  }

  async handleCardOutcome() {
    const removeCardText = this.page.getByText("Select a card to remove");
    const cardChoiceText = this.page.getByText("Choose a Card");
    await expect(async () => {
      const hasRemove = await removeCardText.isVisible().catch(() => false);
      const hasChoice = await cardChoiceText.isVisible().catch(() => false);
      expect(hasRemove || hasChoice).toBe(true);
    }).toPass({ timeout: 5000 });

    if (await removeCardText.isVisible().catch(() => false)) {
      const cardTile = this.cardGrid.locator('[aria-label^="Select "]').first();
      await expect(cardTile).toBeVisible({ timeout: 3000 });
      await cardTile.click();
      await this.page.getByRole("button", { name: /^Remove Card$/ }).click();
    } else {
      const cardChoice = this.page.locator("button[aria-label^='Select']").first();
      await cardChoice.waitFor({ timeout: 3000 });
      await cardChoice.click();
      await this.page.getByRole("button", { name: "Add Card" }).click();
    }
  }
}
