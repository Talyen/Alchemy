import { expect, type Locator, type Page } from "@playwright/test";

export class GameStage {
  private page: Page;
  readonly root: Locator;

  constructor(page: Page) {
    this.page = page;
    this.root = this.page.getByTestId("vr-stage");
  }

  async runPhase(): Promise<string | null> {
    return this.root.getAttribute("data-run-phase");
  }

  async expectRunPhase(phase: string) {
    await expect(this.root).toHaveAttribute("data-run-phase", phase);
  }
}
