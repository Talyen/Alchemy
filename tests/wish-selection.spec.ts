import { expect } from "@playwright/test";
import { test } from "./fixtures/e2e";
import { injectActiveBattle, makeCard, makeGoblinBattleState, startBattleWithDeck } from "./helpers";
import { BattlePage } from "./pages/battle-page";

for (const viewport of [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
]) {
  test(`Wish choices fit and consecutive wishes resolve at ${viewport.width}`, async ({
    page,
    fastBattle,
    runtimeErrors,
  }) => {
    void fastBattle;
    void runtimeErrors;
    await page.setViewportSize(viewport);
    await startBattleWithDeck(
      page,
      Array.from({ length: 6 }, () => makeCard({ cost: 0, effects: [{ kind: "wish", amount: 2 }] })),
    );
    const battle = new BattlePage(page);
    await battle.playFirstCard();
    const panel = page.locator(".wish-overlay-panel");
    const choices = panel.getByRole("button", { name: /^Choose / });
    await expect(panel.getByRole("button", { name: "Confirm", exact: true })).toHaveCount(0);
    await expect(panel.getByRole("button", { name: "Skip", exact: true })).toHaveCount(0);
    await expect(choices).toHaveCount(3);
    for (const choice of await choices.all()) {
      const bounds = await choice.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.width).toBeLessThan(viewport.width / 3);
      expect(bounds!.y).toBeGreaterThanOrEqual(0);
      expect(bounds!.y + bounds!.height).toBeLessThan(viewport.height);
    }
    const handCount = await battle.hand.count();
    await choices.first().click();
    await expect(battle.hand).toHaveCount(handCount + 1);
    await choices.first().click();
    await expect(panel).toBeHidden();
    await expect(battle.hand).toHaveCount(handCount + 2);
  });
}

for (const viewport of [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
]) {
  test(`Four Wish choices share one row at ${viewport.width}`, async ({ page, fastBattle, runtimeErrors }) => {
    void fastBattle;
    void runtimeErrors;
    await page.setViewportSize(viewport);
    const wishOptions = ["slash", "block", "wish", "wishing-well"].map((id) => makeCard({ id }));
    await injectActiveBattle(page, makeGoblinBattleState({ wishOptions }));
    const panel = page.locator(".wish-overlay-panel");
    const choices = panel.getByRole("button", { name: /^Choose / });
    await expect(choices).toHaveCount(4);
    const bounds = await choices.evaluateAll((cards) =>
      cards.map((card) => {
        const rect = card.getBoundingClientRect();
        return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right };
      }),
    );
    for (const [index, rect] of bounds.entries()) {
      expect(Math.abs(rect.top - bounds[0]!.top)).toBeLessThan(1);
      expect(rect.top).toBeGreaterThanOrEqual(0);
      expect(rect.bottom).toBeLessThan(viewport.height);
      expect(rect.left).toBeGreaterThanOrEqual(index === 0 ? 0 : bounds[index - 1]!.right);
      expect(rect.right).toBeLessThan(viewport.width);
    }
    await page.keyboard.press("Escape");
    await expect(panel).toBeVisible();
    const choice = choices.first();
    await expect(choice.locator(".shine-border")).toHaveCount(0);
    await choice.hover();
    await expect(choice.locator(".shine-border")).toHaveCount(1);
    await panel.getByRole("heading", { name: "Wish", exact: true }).hover();
    await expect(choice.locator(".shine-border")).toHaveCount(0);
    await choice.focus();
    await expect(choice.locator(".shine-border")).toHaveCount(1);
    await choice.press("Enter");
    await expect(panel).toBeHidden();
    await expect(new BattlePage(page).hand).toHaveCount(1);
  });
}
