import { expect, type Page } from "@playwright/test";
import { injectHomestead, openGameModeSelect, selectGameMode } from "../helpers";
import type { GameMode } from "../e2e/types";
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

  async gotoWithUnlockedMeta(overrides: Parameters<typeof injectHomestead>[1] = {}) {
    await injectHomestead(this.page, overrides);
    await this.goto();
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

  async openTalents() {
    await this.talentsBtn.click();
    await expect(this.page.getByRole("heading", { name: "Talents" })).toBeVisible();
  }

  async openGameModeSelect() {
    await openGameModeSelect(this.page);
  }

  /** Play → mode picker → character select (no battle start). */
  async goToCharacterSelect(mode: GameMode = "campaign") {
    await this.goto();
    await selectGameMode(this.page, mode);
    await expect(this.page.getByRole("heading", { name: "Choose Your Hero" })).toBeVisible({ timeout: 5000 });
  }

  /** Unlocked roster save → mode picker → character select. */
  async goToCharacterSelectUnlocked(
    mode: GameMode = "campaign",
    homesteadOverrides: Parameters<typeof injectHomestead>[1] = {},
  ) {
    await this.gotoWithUnlockedMeta({
      finishedRunCharacters: ["knight", "rogue", "wizard", "ranger", "alchemist", "warlock", "druid"],
      ...homesteadOverrides,
    });
    await selectGameMode(this.page, mode);
    await expect(this.page.getByRole("heading", { name: "Choose Your Hero" })).toBeVisible({ timeout: 5000 });
  }

  async selectCharacterAndContinue(character: "Knight" | "Ranger" | "Rogue" | "Wizard" = "Knight") {
    await this.page.getByRole("button", { name: character }).click();
    await this.page.getByRole("button", { name: "Continue" }).click();
  }

  async startCampaign(character: "Knight" | "Ranger" | "Rogue" | "Wizard" = "Knight") {
    await selectGameMode(this.page, "campaign");
    await this.selectCharacterAndContinue(character);
    await expect(this.page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 5000 });
  }
}
