import { expect, type Page } from "@playwright/test";
import type { BattlePage } from "../tests/pages/battle-page";

export async function waitForCombatDecision(
  page: Page,
  battle: BattlePage,
  resolveWish: () => Promise<void>,
): Promise<void> {
  // A Wish can appear while the last card is still resolving. Recheck after
  // each resolved choice so End Turn never waits behind an unhandled overlay.
  while (true) {
    await expect
      .poll(
        async () => {
          if (await battle.isBattleOver()) return true;
          if (await page.locator(".wish-overlay-panel").isVisible()) return true;
          return battle.endTurnBtn.isEnabled().catch(() => false);
        },
        { timeout: 20_000 },
      )
      .toBe(true);
    if (await battle.isBattleOver()) return;
    if (!(await page.locator(".wish-overlay-panel").isVisible())) return;
    await resolveWish();
  }
}
