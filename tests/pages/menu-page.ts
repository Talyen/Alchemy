import { expect, type Locator, type Page } from "@playwright/test";
import { openGameModeSelect, selectGameMode } from "../e2e/navigation";
import { injectHomestead } from "../e2e/save-injection";
import type { GameMode } from "../e2e/types";
import { GameStage } from "./game-stage";

export class MenuPage {
  private page: Page;
  readonly stage: GameStage;
  readonly playBtn: Locator;
  readonly collectionBtn: Locator;
  readonly optionsBtn: Locator;
  readonly talentsBtn: Locator;
  readonly homesteadBtn: Locator;

  constructor(page: Page) {
    this.page = page;
    this.stage = new GameStage(page);
    this.playBtn = this.page.getByRole("button", { name: "Play", exact: true });
    this.collectionBtn = this.page.getByRole("button", { name: "Collection" });
    this.optionsBtn = this.page.getByRole("button", { name: "Options" });
    this.talentsBtn = this.page.getByRole("button", { name: "Talents" });
    this.homesteadBtn = this.page.getByRole("button", { name: "Homestead" });
  }

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

  async goToCharacterSelect(mode: GameMode = "campaign") {
    await this.goto();
    await selectGameMode(this.page, mode);
    await expect(this.page.getByRole("heading", { name: "Choose Your Hero" })).toBeVisible({ timeout: 5000 });
  }

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
