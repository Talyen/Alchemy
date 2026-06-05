import { expect, type Page } from "@playwright/test";
import { startAtDestination } from "../helpers";
import { GameStage } from "./game-stage";

export class CorruptionPage {
  readonly stage: GameStage;

  constructor(private page: Page) {
    this.stage = new GameStage(page);
  }

  readonly altarHeading = this.page.getByRole("heading", { name: "Altar of Corruption" });
  readonly corruptBtn = this.page.getByRole("button", { name: "Corrupt a Card" });
  readonly confirmCorruptBtn = this.page.getByRole("button", { name: "Corrupt" });
  readonly leaveBtn = this.page.getByRole("button", { name: "Leave" });
  readonly continueBtn = this.page.getByRole("button", { name: "Continue" });
  readonly cardGrid = this.page.locator('[data-testid="card-selection-grid"]');

  async open() {
    await startAtDestination(this.page, {}, { forceDestination: "Corruption" });
    await this.page.getByRole("button", { name: "Corruption" }).click();
  }

  async selectAndCorrupt(index = 0) {
    await this.corruptBtn.click();
    await expect(this.cardGrid).toBeVisible({ timeout: 3000 });
    const card = this.cardGrid.locator('[aria-label^="Select "]').nth(index);
    await card.click({ force: true });
    await this.confirmCorruptBtn.click();
    await expect(this.continueBtn).toBeVisible({ timeout: 3000 });
  }
}
