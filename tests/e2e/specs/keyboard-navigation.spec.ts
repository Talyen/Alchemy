import { expect, test } from "../../fixtures/e2e";
import {
  makeCard,
  startBattleWithDeck,
  enterPrimaryRewardScreen,
  injectActiveBattle,
  makeGoblinBattleState,
} from "../../browser-helpers";
import { BattlePage } from "../../pages/battle-page";
import { DestinationPage } from "../../pages/destination-page";
import { critical } from "../../playwright-tags";
import { controllerInput } from "../controller-input";

test.describe("Controller-equivalent keyboard navigation", critical, () => {
  test("menu to first battle uses only mapped keys", async ({ page }) => {
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

  test("playing consecutive cards recovers focus, then reaches End Turn", async ({ page, fastBattle }) => {
    void fastBattle;
    await startBattleWithDeck(
      page,
      Array.from({ length: 6 }, () => makeCard({ effects: [{ kind: "player-status", status: "block", amount: 1 }] })),
      { autoEndTurn: false },
    );
    const input = controllerInput(page);
    const battle = new BattlePage(page);
    await battle.waitForOpeningHand();
    await expect(battle.endTurnBtn).toBeEnabled();
    await expect(battle.hand.first()).toBeEnabled();
    await input.press("back");
    await expect(page.getByRole("button", { name: "Main Menu", exact: true })).toBeVisible();
    await input.press("back");
    await expect(page.getByTestId("game-menu")).toHaveCount(0);
    await input.reach(battle.hand.first());
    for (let played = 0; played < 4; played++) {
      const count = await battle.hand.count();
      await input.press("confirm");
      await expect(battle.hand).toHaveCount(count - 1);
      if (played < 3) await expect(battle.hand.first()).toBeFocused();
    }
    await expect(battle.endTurnBtn).toBeFocused();
    await input.press("confirm");
    await expect(battle.endTurnBtn).toBeEnabled();
  });

  test("keyboard navigation selects destinations and claims rewards", async ({ page, fastBattle }) => {
    void fastBattle;
    await enterPrimaryRewardScreen(page, {
      rewardType: "card",
      choiceIds: ["slash", "bash"],
      destinations: ["Normal Combat", "Campfire"],
    });
    const input = controllerInput(page);
    await input.activate(page.getByRole("button", { name: /^Select / }).first());
    await new DestinationPage(page).expectVisible();
    await input.activate(page.getByRole("button", { name: "Combat", exact: true }));
    await expect(new BattlePage(page).endTurnBtn).toBeVisible();
  });
});

test("held confirm cannot play the next card after a real transfer", critical, async ({ page }) => {
  const cards = Array.from({ length: 3 }, () =>
    makeCard({ cost: 0, effects: [{ kind: "player-status", status: "block", amount: 1 }] }),
  );
  await injectActiveBattle(page, makeGoblinBattleState({ hand: cards }), { autoEndTurn: false, runDeck: cards });
  const input = controllerInput(page);
  const battle = new BattlePage(page);
  await input.reach(battle.hand.nth(1));
  await page.keyboard.down("Enter");
  await page.keyboard.down("Enter");
  await expect(battle.hand).toHaveCount(2);
  await expect(battle.hand.nth(1)).toBeFocused();
  await page.keyboard.down("Enter");
  await page.keyboard.up("Enter");
  await expect(battle.hand).toHaveCount(2);
  await input.press("confirm");
  await expect(battle.hand).toHaveCount(1);
  await expect(battle.hand.first()).toBeFocused();
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
  await expect(battle.endTurnBtn).toBeEnabled();
  await expect(page.locator(".card-ghost-overlay")).toHaveCount(0);
  expect(await page.getByTestId("battle-hand").evaluate((hand) => hand.contains(document.activeElement))).toBe(false);
});
