import { exerciseFocusInputOptions, exerciseFocusInputBattle } from "../focus-input";
import { expect, test } from "../../fixtures/e2e";
import { makeCard, injectActiveBattle, makeGoblinBattleState } from "../../browser-helpers";
import { BattlePage } from "../../pages/battle-page";
import { DestinationPage } from "../../pages/destination-page";
import { critical } from "../../playwright-tags";
import { controllerInput } from "../controller-input";

test.describe("Controller-equivalent keyboard navigation", () => {
  test("menu to first battle uses only mapped keys", critical, async ({ page }) => {
    const input = controllerInput(page);
    await page.goto("/");
    await input.activate(page.getByRole("button", { name: "Play", exact: true }));
    await expect(page.getByRole("button", { name: "Back", exact: true })).toBeFocused();
    await input.activate(page.getByRole("button", { name: "The Campaign", exact: true }));
    await input.activate(page.getByRole("button", { name: "Select Knight", exact: true }));
    const battle = new BattlePage(page);
    await battle.waitForOpeningHand();
    await expect(battle.endTurnBtn).toBeEnabled();
    await expect(battle.hand.first()).toBeEnabled();
    await input.reach(battle.hand.first());
    const count = await battle.hand.count();
    await input.press("confirm");
    await expect(battle.hand).toHaveCount(count - 1);
  });
});

test("held confirm spends one card, fresh presses recover focus through End Turn", critical, async ({ page }) => {
  const cards = Array.from({ length: 6 }, () =>
    makeCard({ cost: 0, effects: [{ kind: "player-status", status: "block", amount: 1 }] }),
  );
  await injectActiveBattle(page, makeGoblinBattleState({ hand: cards.slice(0, 4), deck: cards.slice(4) }), {
    autoEndTurn: false,
    runDeck: cards,
  });
  const input = controllerInput(page);
  const battle = new BattlePage(page);
  await expect(battle.endTurnBtn).toBeEnabled();
  await input.press("back");
  await expect(page.getByTestId("game-menu")).toBeVisible();
  await input.press("back");
  await expect(page.getByTestId("game-menu")).toHaveCount(0);
  await input.reach(battle.hand.nth(1));
  await page.keyboard.down("Enter");
  await page.keyboard.down("Enter");
  await expect(battle.hand).toHaveCount(3);
  await expect(battle.hand.nth(1)).toBeFocused();
  await page.keyboard.down("Enter");
  await page.keyboard.up("Enter");
  await expect(battle.hand).toHaveCount(3);
  for (let remaining = 2; remaining >= 0; remaining -= 1) {
    await input.press("confirm");
    await expect(battle.hand).toHaveCount(remaining);
    if (remaining > 0) await expect(battle.hand.nth(Math.min(1, remaining - 1))).toBeFocused();
  }
  await expect(battle.endTurnBtn).toBeFocused();
  await input.press("confirm");
  await expect(battle.hand).toHaveCount(4);
  await expect(battle.endTurnBtn).toBeEnabled();
});

test("keyboard combat victory continues through rewards to a destination", critical, async ({ page, fastBattle }) => {
  void fastBattle;
  const cards = Array.from({ length: 3 }, () =>
    makeCard({ cost: 0, effects: [{ kind: "damage", damageType: "physical", amount: 20 }] }),
  );
  await injectActiveBattle(page, makeGoblinBattleState({ hand: cards, enemyHealth: 30, enemyMaxHealth: 30 }), {
    autoEndTurn: false,
    runDeck: cards,
  });
  const input = controllerInput(page);
  const battle = new BattlePage(page);
  await input.activate(battle.hand.first());
  await expect(battle.hand.first()).toBeFocused();
  await input.press("confirm");
  await expect(battle.victoryHeading).toBeVisible();
  await input.activate(page.getByRole("button", { name: /^Select / }).first());
  await new DestinationPage(page).expectVisible();
  await input.activate(page.getByRole("button", { name: /Combat/, exact: false }).first());
  await battle.waitForOpeningHand();
});

test("opening the menu during card transfer cancels hand focus recovery", critical, async ({ page }) => {
  const cards = Array.from({ length: 3 }, () =>
    makeCard({ cost: 0, effects: [{ kind: "player-status", status: "block", amount: 1 }] }),
  );
  await injectActiveBattle(page, makeGoblinBattleState({ hand: cards }), { autoEndTurn: false, runDeck: cards });
  const input = controllerInput(page);
  const battle = new BattlePage(page);
  await input.activate(battle.hand.first());
  await expect(page.locator(".card-ghost-overlay")).toHaveCount(1);
  await input.press("back");
  await expect(page.getByTestId("game-menu")).toBeVisible();
  await expect(battle.hand).toHaveCount(2);
  await expect(battle.endTurnBtn).toBeDisabled();
  await expect(page.locator(".card-ghost-overlay")).toHaveCount(0);
  expect(await page.getByTestId("battle-hand").evaluate((hand) => hand.contains(document.activeElement))).toBe(false);
  await input.press("back");
  await expect(page.getByTestId("game-menu")).toHaveCount(0);
  await expect(battle.endTurnBtn).toBeEnabled();
  expect(await page.getByTestId("battle-hand").evaluate((hand) => hand.contains(document.activeElement))).toBe(false);
});

test(
  "Escape, pointer clicks and wheel input keep focus inactive until fresh keyboard input",
  critical,
  async ({ page }) => {
    test.setTimeout(45_000);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/");
    await exerciseFocusInputOptions(page);
  },
);

test(
  "wheel input cancels real card-transfer recovery and pointer inspection stays unfocused",
  critical,
  async ({ page }) => {
    test.setTimeout(45_000);
    await exerciseFocusInputBattle(page);
  },
);
