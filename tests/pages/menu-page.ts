import { expect, type Page } from "@playwright/test";
import { GameStage } from "./game-stage";

export class MenuPage {
  readonly stage: GameStage;

  constructor(private page: Page) {
    this.stage = new GameStage(page);
  }

  readonly playBtn = this.page.getByRole("button", { name: "Play", exact: true });
  readonly collectionBtn = this.page.getByRole("button", { name: "Collection" });
  readonly optionsBtn = this.page.getByRole("button", { name: "Options" });
  readonly talentsBtn = this.page.getByRole("button", { name: "Talents" });
  readonly homesteadBtn = this.page.getByRole("button", { name: "Homestead" });

  async goto() {
    await this.page.goto("/");
  }

  async expectMainMenu(timeout = 5000) {
    await expect(this.playBtn).toBeVisible({ timeout });
  }

  /** Cold start without alchemy-skip-loading-screen; allow full asset preload (up to ~12s). */
  async expectMainMenuAfterColdStart() {
    await this.expectMainMenu(15_000);
  }

  async openCollection() {
    await this.collectionBtn.click();
    await expect(this.page.getByRole("heading", { name: "Collection" })).toBeVisible();
  }

  async openOptions() {
    await this.optionsBtn.click();
    await expect(this.page.getByRole("heading", { name: "Options" })).toBeVisible();
  }

  async openHomestead() {
    await this.homesteadBtn.click();
    await expect(this.page.getByRole("heading", { name: "Homestead" })).toBeVisible();
  }
}
