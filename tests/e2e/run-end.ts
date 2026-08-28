import { expect, type Page } from "@playwright/test";

import { MenuPage } from "../pages/menu-page";

export async function completeRunEndToMenu(page: Page) {
  const menu = new MenuPage(page);
  const continueBtn = page.getByRole("button", { name: "Continue" });

  await expect(continueBtn).toBeVisible({ timeout: 5000 });
  await continueBtn.click();

  await menu.expectMainMenu(10000);
}
