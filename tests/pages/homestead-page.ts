import { expect, type Page } from "@playwright/test";
import { injectHomestead } from "../helpers";
import { MenuPage } from "./menu-page";

export class HomesteadPage {
  constructor(private page: Page) {}

  readonly heading = this.page.getByRole("heading", { name: "Homestead" });
  readonly buildingsTab = this.page.getByRole("button", { name: "Buildings" });
  readonly farmTab = this.page.getByRole("button", { name: "Farm" });
  readonly researchTab = this.page.getByRole("button", { name: "Research" });
  readonly companionsTab = this.page.getByRole("button", { name: "Companions" });

  async goto(overrides: Parameters<typeof injectHomestead>[1] = {}) {
    await injectHomestead(this.page, overrides);
    const menu = new MenuPage(this.page);
    await menu.goto();
    await menu.openHomestead();
  }

  async switchTab(name: "Buildings" | "Farm" | "Research" | "Companions") {
    await this.page.getByRole("button", { name }).click();
  }

  constructButton() {
    return this.page.getByRole("button", { name: /Construct|Build|Upgrade|Craft/ }).first();
  }

  async getBuildingText(name: string) {
    return this.page.getByText(name).first();
  }

  materialPill(material: "Wood" | "Iron" | "Herbs" | "Food" | "Crystal", amount: number) {
    return this.page.getByText(`${amount} ${material}`);
  }
}
