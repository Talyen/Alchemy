import { expect, type Page } from "@playwright/test";

/** VR stage shell exposed by App (`data-testid="vr-stage"`). */
export class GameStage {
  constructor(private page: Page) {}

  readonly root = this.page.getByTestId("vr-stage");

  async runPhase(): Promise<string | null> {
    return this.root.getAttribute("data-run-phase");
  }

  async expectRunPhase(phase: string) {
    await expect(this.root).toHaveAttribute("data-run-phase", phase);
  }
}
