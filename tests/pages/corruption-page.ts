import { type Locator, type Page } from "@playwright/test";
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
}
