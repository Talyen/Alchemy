import { type Locator, type Page } from "@playwright/test";
import { injectHomestead } from "../e2e/save-injection";
import { MenuPage } from "./menu-page";

export class HomesteadPage {
  private page: Page;
  readonly heading: Locator;
  readonly buildingsTab: Locator;
  readonly farmTab: Locator;
  readonly researchTab: Locator;
  readonly companionsTab: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = this.page.getByRole("heading", { name: "Homestead" });
    this.buildingsTab = this.page.getByRole("button", { name: "Buildings" });
    this.farmTab = this.page.getByRole("button", { name: "Farm" });
    this.researchTab = this.page.getByRole("button", { name: "Research" });
    this.companionsTab = this.page.getByRole("button", { name: "Companions" });
  }

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

  materialPill(material: "Wood" | "Iron" | "Herbs" | "Food" | "Gems" | "Crystal" | "Gold", amount: number) {
    return this.page
      .getByText(new RegExp(`^${material}$`, "i"))
      .locator("xpath=..")
      .getByText(String(amount))
      .locator("xpath=../..");
  }
}
