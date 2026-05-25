import { expect, type Page } from "@playwright/test";

export class HomesteadPage {
  constructor(private page: Page) {}

  readonly heading = this.page.getByRole("heading", { name: "Homestead" });
  readonly buildingsTab = this.page.getByRole("button", { name: "Buildings" });
  readonly farmTab = this.page.getByRole("button", { name: "Farm" });
  readonly researchTab = this.page.getByRole("button", { name: "Research" });
  readonly companionsTab = this.page.getByRole("button", { name: "Companions" });

  async switchTab(name: "Buildings" | "Farm" | "Research" | "Companions") {
    await this.page.getByRole("button", { name }).click();
  }

  constructButton() {
    return this.page.getByRole("button", { name: /Construct|Build|Upgrade|Craft/ }).first();
  }

  async getBuildingText(name: string) {
    return this.page.getByText(name).first();
  }
}
