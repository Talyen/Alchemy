import { expect, type Locator, type Page } from "@playwright/test";
import type { BattlePage } from "../tests/pages/battle-page";

export async function playCombatCard(page: Page, card: Locator): Promise<void> {
  await expect(card).toBeEnabled();
  await expect.poll(() => card.evaluate((node) => !node.closest("[inert]"))).toBe(true);
  const slot = card.locator("xpath=ancestor::*[@data-hand-slot]");
  const key = await slot.getAttribute("data-hand-slot");
  const bounds = await slot.boundingBox();
  if (!key || !bounds) throw new Error("Combat card lacks its hand slot");
  // Artwork overlaps in a full hand. Real pointer input targets the untransformed
  // slot, which the hand's pointer owner maps to the intended card.
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await expect(slot).toHaveAttribute("data-hovered", "true");
  await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  // A rejected click or a neighbouring card must never count as a played card.
  await expect(page.locator(`[data-hand-slot=${JSON.stringify(key)}]`)).toHaveCount(0);
}

export async function resolveWishPanels(page: Page, choose: (buttons: Locator) => Promise<void>): Promise<void> {
  const panel = page.locator(".wish-overlay-panel");
  for (let choice = 0; choice < 8; choice++) {
    // The next offer can be mounted but hidden while the previous one exits.
    const state: { value: "visible" | "absent" | "transition" } = { value: "transition" };
    await expect
      .poll(async () => {
        state.value = (await panel.isVisible()) ? "visible" : (await panel.count()) === 0 ? "absent" : "transition";
        return state.value;
      })
      .not.toBe("transition");
    if (state.value === "absent") return;
    const current = await panel.elementHandle();
    if (!current) throw new Error("Wish panel disappeared before its choice");
    try {
      await expect.poll(() => current.evaluate((node) => !node.closest("[inert]"))).toBe(true);
      await choose(panel.getByRole("button", { name: /^Choose / }));
      // Each offer has its own panel. Wait for that exact offer to leave before
      // counting another choice; save completion can precede its exit animation.
      await current.waitForElementState("hidden", { timeout: 5_000 });
    } finally {
      await current.dispose();
    }
  }
  await expect(panel).toHaveCount(0);
}

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
