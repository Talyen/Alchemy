import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "../../fixtures/e2e";
import { injectActiveBattle, makeCard, makeGoblinBattleState } from "../../browser-helpers";
import { waitForLayoutSettled } from "../layout-assertions";
import { MenuPage } from "../../pages/menu-page";
import { critical } from "../../playwright-tags";
import type { Page } from "@playwright/test";

async function expectAccessible(page: Page) {
  await waitForLayoutSettled(page);
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(result.violations).toEqual([]);
}

// Rendered colors, accessible names and live dialog semantics need the browser;
// JSX lint and the existing focus journeys cannot detect all of these failures.
test("menu and Options have accessible rendered controls", critical, async ({ page }) => {
  const menu = new MenuPage(page);
  await menu.goto();
  await expectAccessible(page);
  await menu.openOptions();
  await expectAccessible(page);
});

test("battle and card inspection expose accessible controls", critical, async ({ page, fastBattle }) => {
  void fastBattle;
  const card = makeCard({ uid: 101 });
  await injectActiveBattle(page, makeGoblinBattleState({ hand: [card], deck: [card], appliesFightPacing: false }), {
    runDeck: [card],
  });
  await expectAccessible(page);
  await page.getByTestId("draw-pile").getByRole("button").click();
  await expect(page.getByRole("dialog", { name: "Draw Pile", exact: true })).toBeVisible();
  await expectAccessible(page);
});
