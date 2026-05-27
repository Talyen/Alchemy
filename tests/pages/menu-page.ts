import { expect, type Page } from "@playwright/test";

export class MenuPage {
  constructor(private page: Page) {}

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
