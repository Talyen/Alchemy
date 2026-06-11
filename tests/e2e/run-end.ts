// Run-end E2E helpers for defeat/victory Continue flow and discoveries screen.
import { expect, type Page } from "@playwright/test";

import { MenuPage } from "../pages/menu-page";

async function completeDiscoveriesIfShown(page: Page) {
  const menu = new MenuPage(page);
  const discoveries = page.getByRole("heading", { name: "Discoveries" });

  if (!(await discoveries.isVisible().catch(() => false))) return;

  await expect(async () => {
    if (await menu.playBtn.isVisible().catch(() => false)) return;

    await expect(discoveries).toBeVisible();

    const openPack = page.getByLabel("Open discovery pack");
    if (await openPack.isVisible().catch(() => false)) {
      await openPack.click();
      throw new Error("discovery pack opening");
    }

    const continueBtn = page.getByRole("button", { name: "Continue" });
    await expect(continueBtn).toBeEnabled();
    await continueBtn.click({ force: true });

    const reachedMenu = await menu.playBtn.isVisible().catch(() => false);
    const leftDiscoveries = !(await discoveries.isVisible().catch(() => false));
    expect(reachedMenu || leftDiscoveries).toBe(true);
  }).toPass({ timeout: 30_000 });
}

/** Click Continue on defeat/victory, finish discoveries when present, and land on the main menu. */
export async function completeRunEndToMenu(page: Page) {
  const menu = new MenuPage(page);
  const discoveries = page.getByRole("heading", { name: "Discoveries" });
  const continueBtn = page.getByRole("button", { name: "Continue" });

  await expect(continueBtn).toBeVisible({ timeout: 5000 });
  await continueBtn.click();

  await expect(discoveries.or(menu.playBtn)).toBeVisible({ timeout: 5000 });

  await completeDiscoveriesIfShown(page);

  await menu.expectMainMenu(10000);
}
